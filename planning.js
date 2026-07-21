// planning.js — CHRONOGRAMME / PLANNING (livrable 8, chevalet de formation).
// Isolé de app.js volontairement : c'est la partie la plus récente et la moins éprouvée en
// conditions réelles (glisser-déposer, deux vues encadrement/stagiaire) — la garder à part
// limite le risque qu'une future modification ici casse par erreur une fonctionnalité du reste
// de l'appli (Stagiaires, Évaluations, Validation...), et inversement.
// Dépend de : core.js (sb, S, $, esc, toast) + app.js (joursFormation, chargerDonneesSession).
// Chargé après app.js et avant pdf.js dans index.html (pdf.js utilise _blocsPlanningCellule et
// HORAIRES_DEMI pour dessiner le chronogramme du chevalet).

// Horaires fixes des journées de formation (mêmes pour toutes les formations : 40h sur 5 jours,
// 8h-12h / 13h-17h, soit 8h par jour) — affichés à titre indicatif à côté de Matin/Après-midi,
// partout où le chronogramme est montré (onglet Planning, vue stagiaire, chevalet PDF). Si une
// formation particulière a un jour d'horaires différents un jour donné, ça reste gérable à la
// marge via l'annotation d'un bloc ; ce n'est qu'un repère, pas une contrainte de saisie.
const HORAIRES_DEMI = { matin: '8h – 12h', apres_midi: '13h – 17h' };

// ---------- Blocs de planning imposés (GFor, Paramètres formations) ----------
// Modèles définis au niveau de la formation (pas d'une session précise) : la partie « imposée »
// du programme, commune à toutes les sessions de cette formation. Le RP les place ensuite
// librement dans le chronogramme de sa propre session (voir la réserve « Blocs à placer » dans
// ongletPlanning ci-dessous) — jour et demi-journée restent à sa discrétion.
// Un modèle « fixe » (jour_debut + demi_journee renseignés) se replace automatiquement au même
// jour relatif et à la même demi-journée sur CHAQUE session de la formation (ex. réactivation de
// mémoire tous les matins de J2 à J5, bilan journalier tous les après-midis de J1 à J4) : le RP
// n'a rien à glisser, ça apparaît directement dans son chronogramme (voir _assurerBlocsAutoPlanning
// dans ongletPlanning). Un modèle « libre » (demi_journee laissé vide) reste à placer à la main,
// comme avant, via la réserve « Blocs à placer ».
function _optionsDemiModele(m) {
  return `<option value="" ${!m?.demi_journee ? 'selected' : ''}>Libre (à placer à la main)</option>
    <option value="matin" ${m?.demi_journee === 'matin' ? 'selected' : ''}>Matin, fixe</option>
    <option value="apres_midi" ${m?.demi_journee === 'apres_midi' ? 'selected' : ''}>Après-midi, fixe</option>`;
}

async function ecranBlocsPlanningModeles(formationId) {
  const f = (window._formations || []).find(x => x.id === formationId);
  const { data: modeles, error } = await sb.from('blocs_planning_modeles').select('*').eq('formation_id', formationId).order('ordre');
  if (error) return toast(error.message, false);
  window._blocsPlanningModeles = modeles || [];

  const lignes = (modeles || []).map(m => `<tr>
      <td><input value="${esc(m.ordre)}" type="number" style="width:56px" id="bpm-ordre-${m.id}"></td>
      <td><input value="${esc(m.libelle)}" id="bpm-lib-${m.id}"></td>
      <td><input value="${esc(m.annotation || '')}" id="bpm-annot-${m.id}"></td>
      <td><select id="bpm-demi-${m.id}" onchange="$('bpm-jours-'+${m.id}).style.display = this.value ? '' : 'none'">${_optionsDemiModele(m)}</select></td>
      <td id="bpm-jours-${m.id}" style="display:${m.demi_journee ? '' : 'none'};white-space:nowrap">
        <input id="bpm-jd-${m.id}" type="number" min="1" style="width:52px" value="${m.jour_debut || 1}" title="Jour de début (J..)">
        à
        <input id="bpm-jf-${m.id}" type="number" min="1" style="width:52px" value="${m.jour_fin || m.jour_debut || 1}" title="Jour de fin (J..)">
      </td>
      <td style="white-space:nowrap">
        <button class="btn petit secondaire" onclick="enregistrerBlocModele(${m.id})">💾</button>
        <button class="btn petit secondaire" onclick="supprBlocModele(${m.id})">✕</button>
      </td>
    </tr>`).join('');

  $('staff-dashboard').innerHTML = `<div class="carte">
    <span class="lien-retour" onclick="ecranParametresFormations()">← Retour aux paramètres formations</span>
    <h2>Planning imposé — ${esc(f ? f.libelle : '')}</h2>
    <div class="info">Ces blocs représentent la partie du programme commune à toutes les sessions de cette formation.
      Un bloc « fixe » (jour + demi-journée renseignés) se replace automatiquement au même endroit sur chaque session
      (ex. réactivation de mémoire tous les matins de J2 à J5). Un bloc « libre » reste à placer à la main par le RP,
      via la réserve « Blocs à placer » de l'onglet Chronogramme.</div>
    <div class="table-scroll"><table>
      <tr><th>Ordre</th><th>Libellé</th><th>Annotation (facultatif)</th><th>Placement</th><th>Jours (si fixe)</th><th></th></tr>
      ${lignes || '<tr><td colspan="6" class="info">Aucun bloc imposé pour cette formation.</td></tr>'}
    </table></div>
    <h3>Ajouter un bloc imposé</h3>
    <div class="ligne">
      <div><label>Ordre</label><input id="bpm-new-ordre" type="number" value="${(modeles || []).length + 1}"></div>
      <div><label>Libellé</label><input id="bpm-new-lib" placeholder="ex : Réactivation de mémoire"></div>
      <div><label>Annotation (facultatif, réservée à l'encadrement)</label><input id="bpm-new-annot"></div>
    </div>
    <div class="ligne">
      <div><label>Placement</label><select id="bpm-new-demi" onchange="$('bpm-new-jours').style.display = this.value ? '' : 'none'">${_optionsDemiModele(null)}</select></div>
      <div id="bpm-new-jours" style="display:none">
        <label>Du jour … au jour …</label>
        <div class="ligne"><input id="bpm-new-jd" type="number" min="1" value="1"><input id="bpm-new-jf" type="number" min="1" value="1"></div>
      </div>
      <div style="align-self:flex-end"><button class="btn petit" onclick="ajouterBlocModele(${formationId})">➕ Ajouter</button></div>
    </div>
  </div>`;
}

async function enregistrerBlocModele(id) {
  const demi = $('bpm-demi-' + id).value || null;
  const { error } = await sb.from('blocs_planning_modeles').update({
    ordre: Number($('bpm-ordre-' + id).value) || 1,
    libelle: $('bpm-lib-' + id).value.trim(),
    annotation: $('bpm-annot-' + id).value.trim() || null,
    demi_journee: demi,
    jour_debut: demi ? (Number($('bpm-jd-' + id).value) || 1) : null,
    jour_fin: demi ? (Number($('bpm-jf-' + id).value) || Number($('bpm-jd-' + id).value) || 1) : null,
  }).eq('id', id);
  if (error) return toast(error.message, false);
  toast('Bloc imposé mis à jour');
}

async function ajouterBlocModele(formationId) {
  const libelle = $('bpm-new-lib').value.trim();
  if (!libelle) return toast('Libellé requis', false);
  const demi = $('bpm-new-demi').value || null;
  const { error } = await sb.from('blocs_planning_modeles').insert({
    formation_id: formationId, libelle,
    annotation: $('bpm-new-annot').value.trim() || null,
    ordre: Number($('bpm-new-ordre').value) || 1,
    demi_journee: demi,
    jour_debut: demi ? (Number($('bpm-new-jd').value) || 1) : null,
    jour_fin: demi ? (Number($('bpm-new-jf').value) || Number($('bpm-new-jd').value) || 1) : null,
  });
  if (error) return toast(error.message, false);
  toast('Bloc imposé ajouté');
  ecranBlocsPlanningModeles(formationId);
}

async function supprBlocModele(id) {
  if (!confirm('Supprimer ce bloc imposé ? Les instances déjà placées dans des sessions existantes seront conservées mais perdront leur lien avec ce modèle.')) return;
  const formationId = (window._blocsPlanningModeles || []).find(m => m.id === id)?.formation_id;
  const { error } = await sb.from('blocs_planning_modeles').delete().eq('id', id);
  if (error) return toast(error.message, false);
  toast('Bloc imposé supprimé');
  if (formationId) ecranBlocsPlanningModeles(formationId);
  else ecranParametresFormations();
}

// ---------- Onglet Chronogramme / Planning (formateur/RP/GFor) ----------
// Grille Jour × Matin/Après-midi, blocs libres déplaçables par glisser-déposer (drag & drop
// HTML5 natif, pas de librairie). Vue encadrement : libellé (visible stagiaire) + annotation
// (réservée à l'encadrement, ex. « présence infirmier »), jamais transmise à la vue stagiaire
// (voir blocStagiaireChronogramme, qui n'affiche que le libellé).
function _blocsPlanningCellule(jour, demi) {
  return (S.data.blocsPlanning || []).filter(b => b.jour === jour && b.demi_journee === demi).sort((a, b) => a.ordre - b.ordre);
}

// Modèles de la formation en cours, mis en cache le temps de l'onglet (rechargé à chaque
// ouverture/rafraîchissement de l'onglet — coût négligeable, une seule petite requête).
let _modelesPlanningCourants = [];

// Modèles « libres » pas encore placés dans CETTE session : ceux dont aucun bloc_planning de la
// session ne référence leur id, ET qui n'ont pas de jour/demi-journée fixe (un modèle fixe ne
// passe jamais par la réserve, voir _assurerBlocsAutoPlanning). Dès qu'on supprime le dernier
// bloc libre placé pour un modèle, il revient donc automatiquement dans la réserve.
function _modelesNonPlaces() {
  const idsPlaces = new Set((S.data.blocsPlanning || []).filter(b => b.modele_id).map(b => b.modele_id));
  return _modelesPlanningCourants.filter(m => !m.demi_journee && !idsPlaces.has(m.id));
}

// Instancie automatiquement, pour la session en cours, les blocs issus des modèles « fixes »
// (jour_debut/jour_fin/demi_journee renseignés) — ex. réactivation de mémoire tous les matins de
// J2 à J5. Ne crée que ce qui manque encore (idempotent : sans effet si déjà placé, y compris si
// le RP l'a depuis déplacé ailleurs — on ne recrée alors une instance QUE pour les jours où il n'y
// en a pas encore). Retourne true si au moins un bloc a été créé.
// Appelée à la fois par ongletPlanning (RP/GFor consultant l'onglet Chronogramme) et par
// ouvrirSession dans app.js (dès l'ouverture de la session, staff uniquement — le stagiaire, en
// accès anonyme, n'a pas le droit d'écrire dans blocs_planning) pour que les blocs imposés soient
// déjà en place avant même que quelqu'un aille voir l'onglet, garantissant qu'ils apparaissent
// aussi côté vue stagiaire (accès lecture seule).
async function assurerBlocsPlanningFixes() {
  const { data: modeles, error } = await sb.from('blocs_planning_modeles').select('*').eq('formation_id', S.formation.id).order('ordre');
  if (error) return false;
  _modelesPlanningCourants = modeles || [];
  const fixes = _modelesPlanningCourants.filter(m => m.demi_journee && m.jour_debut);
  if (!fixes.length) return false;
  const nbJours = (S.formation && S.formation.nb_jours) || 5;
  let cree = false;
  for (const m of fixes) {
    const jourFin = Math.min(m.jour_fin || m.jour_debut, nbJours);
    for (let j = m.jour_debut; j <= jourFin; j++) {
      const jourStr = 'J' + j;
      const dejaPlace = (S.data.blocsPlanning || []).some(b => b.modele_id === m.id && b.jour === jourStr && b.demi_journee === m.demi_journee);
      if (dejaPlace) continue;
      const ordre = _blocsPlanningCellule(jourStr, m.demi_journee).length;
      const { error: errIns } = await sb.from('blocs_planning').insert({
        session_id: S.session.id, jour: jourStr, demi_journee: m.demi_journee, ordre,
        libelle: m.libelle, annotation: m.annotation, modele_id: m.id,
      });
      if (!errIns) cree = true;
    }
  }
  return cree;
}

async function ongletPlanning() {
  const aCree = await assurerBlocsPlanningFixes();
  if (aCree) await chargerDonneesSession(S.session.id);
  _rendreOngletPlanning();
}

function _rendreOngletPlanning() {
  const jours = joursFormation();
  const demiJournees = [['matin', 'Matin (' + HORAIRES_DEMI.matin + ')'], ['apres_midi', 'Après-midi (' + HORAIRES_DEMI.apres_midi + ')']];
  const reserve = _modelesNonPlaces();

  let cellules = '';
  demiJournees.forEach(([demiId, demiLbl]) => {
    cellules += `<div class="planning-label-demi" style="align-self:center">${demiLbl}</div>`;
    jours.forEach(j => {
      const blocs = _blocsPlanningCellule(j, demiId);
      cellules += `<div class="planning-cellule" ondragover="event.preventDefault(); this.classList.add('survol')"
        ondragleave="this.classList.remove('survol')" ondrop="deposerBlocPlanning(event, '${j}', '${demiId}')">
        ${blocs.map(b => `
          <div class="bloc-planning" draggable="true" ondragstart='event.dataTransfer.setData("text/plain", JSON.stringify({type:"bloc", id:${b.id}}))'>
            <div class="libelle-bloc">${b.modele_id ? '🔒 ' : ''}${esc(b.libelle)}</div>
            ${b.annotation ? `<div class="annotation-bloc">🗒 ${esc(b.annotation)}</div>` : ''}
            <div class="actions-bloc">
              <span onclick="formBlocPlanning(${b.id})">Modifier</span>
              <span onclick="supprimerBlocPlanning(${b.id})">Supprimer</span>
            </div>
          </div>`).join('')}
        <button class="btn-ajout-bloc" onclick="formBlocPlanning(null, '${j}', '${demiId}')">+ Ajouter</button>
      </div>`;
    });
  });

  $('session-contenu').innerHTML = `
    <div class="carte">
      <h2>Chronogramme / Planning</h2>
      <div class="info">Glisse-dépose les blocs entre jours et demi-journées pour réorganiser le programme.
        🔒 = bloc imposé (défini par le GFor pour cette formation) · 🗒 = annotation réservée à l'encadrement, jamais visible du stagiaire.</div>
      ${reserve.length ? `
      <h3>Blocs à placer (imposés par la formation)</h3>
      <div class="info">Glisse ces blocs dans le chronogramme ci-dessous, au jour et à la demi-journée de ton choix.</div>
      <div class="reserve-planning" ondragover="event.preventDefault()">
        ${reserve.map(m => `
          <div class="bloc-planning bloc-planning-reserve" draggable="true" ondragstart='event.dataTransfer.setData("text/plain", JSON.stringify({type:"modele", id:${m.id}}))'>
            <div class="libelle-bloc">🔒 ${esc(m.libelle)}</div>
          </div>`).join('')}
      </div>` : ''}
      <div class="table-scroll-planning">
        <div class="grille-planning" style="grid-template-columns: 70px repeat(${jours.length}, 1fr)">
          <div></div>${jours.map(j => `<div class="planning-entete-jour">${esc(j)}</div>`).join('')}
          ${cellules}
        </div>
      </div>
      <div id="planning-form" style="margin-top:14px"></div>
    </div>`;
}

function formBlocPlanning(blocId, jour, demi) {
  const b = blocId ? (S.data.blocsPlanning || []).find(x => x.id === blocId) : null;
  const jourVal = b ? b.jour : jour;
  const demiVal = b ? b.demi_journee : demi;
  // Un bloc issu d'un modèle imposé garde son libellé fixe (défini par le GFor) : seule
  // l'annotation reste modifiable par le RP, pour ne pas faire diverger le programme imposé.
  const verrouille = b && b.modele_id;
  $('planning-form').innerHTML = `
    <div class="carte" style="background:#f7f7f9">
      <h3>${b ? 'Modifier le bloc' : 'Nouveau bloc'} — ${esc(jourVal)} ${demiVal === 'matin' ? 'matin' : 'après-midi'}</h3>
      ${verrouille ? `<div class="info">🔒 Bloc imposé par la formation — le libellé n'est modifiable que depuis Paramètres formations → Planning imposé.</div>` : ''}
      <label>Thématique / activité (visible du stagiaire)</label>
      <input id="pf-libelle" value="${b ? esc(b.libelle) : ''}" ${verrouille ? 'disabled' : ''}>
      <label>Annotation formateur (facultatif, jamais visible du stagiaire)</label>
      <textarea id="pf-annotation">${b && b.annotation ? esc(b.annotation) : ''}</textarea>
      <button class="btn" onclick="enregistrerBlocPlanning(${blocId || 'null'}, '${jourVal}', '${demiVal}')">Enregistrer</button>
      <button class="btn secondaire" onclick="$('planning-form').innerHTML=''">Annuler</button>
    </div>`;
}

async function enregistrerBlocPlanning(blocId, jour, demi) {
  const annotation = $('pf-annotation').value.trim() || null;
  if (blocId) {
    const b = (S.data.blocsPlanning || []).find(x => x.id === blocId);
    // Bloc imposé : le libellé ne se modifie pas ici (champ désactivé), seule l'annotation change.
    const payload = (b && b.modele_id) ? { annotation } : { libelle: $('pf-libelle').value.trim(), annotation };
    if (!payload.libelle && !(b && b.modele_id)) return toast('Thématique obligatoire', false);
    const { error } = await sb.from('blocs_planning').update(payload).eq('id', blocId);
    if (error) return toast(error.message, false);
  } else {
    const libelle = $('pf-libelle').value.trim();
    if (!libelle) return toast('Thématique obligatoire', false);
    const ordre = _blocsPlanningCellule(jour, demi).length;
    const { error } = await sb.from('blocs_planning').insert({
      session_id: S.session.id, jour, demi_journee: demi, ordre, libelle, annotation,
    });
    if (error) return toast(error.message, false);
  }
  await chargerDonneesSession(S.session.id);
  toast('Bloc enregistré');
  _rendreOngletPlanning();
}

async function supprimerBlocPlanning(blocId) {
  const b = (S.data.blocsPlanning || []).find(x => x.id === blocId);
  const msg = b && b.modele_id
    ? 'Supprimer ce bloc imposé de ton chronogramme ? Il repassera dans la réserve « Blocs à placer », tu pourras le replacer plus tard.'
    : 'Supprimer ce bloc ?';
  if (!confirm(msg)) return;
  const { error } = await sb.from('blocs_planning').delete().eq('id', blocId);
  if (error) return toast(error.message, false);
  await chargerDonneesSession(S.session.id);
  _rendreOngletPlanning();
}

async function deposerBlocPlanning(ev, jour, demi) {
  ev.preventDefault();
  ev.currentTarget.classList.remove('survol');
  let payload;
  try { payload = JSON.parse(ev.dataTransfer.getData('text/plain')); } catch (e) { return; }
  if (!payload || !payload.id) return;
  const ordre = _blocsPlanningCellule(jour, demi).length;

  if (payload.type === 'modele') {
    // Premier placement d'un bloc imposé dans cette session : on crée l'instance à partir du
    // modèle (libellé + annotation copiés), reliée par modele_id.
    const m = _modelesPlanningCourants.find(x => x.id === payload.id);
    if (!m) return;
    const { error } = await sb.from('blocs_planning').insert({
      session_id: S.session.id, jour, demi_journee: demi, ordre,
      libelle: m.libelle, annotation: m.annotation, modele_id: m.id,
    });
    if (error) return toast(error.message, false);
  } else {
    // Déplacement d'un bloc déjà placé (imposé ou libre) vers une autre case.
    const { error } = await sb.from('blocs_planning').update({ jour, demi_journee: demi, ordre }).eq('id', payload.id);
    if (error) return toast(error.message, false);
  }
  await chargerDonneesSession(S.session.id);
  _rendreOngletPlanning();
}

// ---------- Vue stagiaire (utilisée par app.js dans ecranAccueilStagiaire) ----------
// Uniquement le libellé (thématique), jamais l'annotation formateur — c'est la seule différence
// avec la vue encadrement (ongletPlanning).
function blocStagiaireChronogramme() {
  const jours = joursFormation();
  const lignes = jours.map(j => {
    const txt = demi => _blocsPlanningCellule(j, demi).map(b => esc(b.libelle)).join('<br>') || '—';
    return `<tr><td><b>${esc(j)}</b></td><td>${txt('matin')}</td><td>${txt('apres_midi')}</td></tr>`;
  }).join('');
  return `<div class="carte">
    <h2>Programme de la semaine</h2>
    <div class="table-scroll"><table>
      <tr><th>Jour</th><th>Matin (${esc(HORAIRES_DEMI.matin)})</th><th>Après-midi (${esc(HORAIRES_DEMI.apres_midi)})</th></tr>
      ${lignes}
    </table></div>
  </div>`;
}
