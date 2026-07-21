// planning.js — CHRONOGRAMME / PLANNING (livrable 8, chevalet de formation).
// Isolé de app.js volontairement : c'est la partie la plus récente et la moins éprouvée en
// conditions réelles (glisser-déposer, deux vues encadrement/stagiaire) — la garder à part
// limite le risque qu'une future modification ici casse par erreur une fonctionnalité du reste
// de l'appli (Stagiaires, Évaluations, Validation...), et inversement.
// Dépend de : core.js (sb, S, $, esc, toast) + app.js (joursFormation, chargerDonneesSession).
// Chargé après app.js et avant pdf.js dans index.html (pdf.js utilise _blocsPlanningCellule
// pour dessiner le chronogramme du chevalet).

// ---------- Onglet Chronogramme / Planning (formateur/RP/GFor) ----------
// Grille Jour × Matin/Après-midi, blocs libres déplaçables par glisser-déposer (drag & drop
// HTML5 natif, pas de librairie). Vue encadrement : libellé (visible stagiaire) + annotation
// (réservée à l'encadrement, ex. « présence infirmier »), jamais transmise à la vue stagiaire
// (voir blocStagiaireChronogramme, qui n'affiche que le libellé).
function _blocsPlanningCellule(jour, demi) {
  return (S.data.blocsPlanning || []).filter(b => b.jour === jour && b.demi_journee === demi).sort((a, b) => a.ordre - b.ordre);
}

function ongletPlanning() {
  const jours = joursFormation();
  const demiJournees = [['matin', 'Matin'], ['apres_midi', 'Après-midi']];

  let cellules = '';
  demiJournees.forEach(([demiId, demiLbl]) => {
    cellules += `<div class="planning-label-demi" style="align-self:center">${demiLbl}</div>`;
    jours.forEach(j => {
      const blocs = _blocsPlanningCellule(j, demiId);
      cellules += `<div class="planning-cellule" ondragover="event.preventDefault(); this.classList.add('survol')"
        ondragleave="this.classList.remove('survol')" ondrop="deposerBlocPlanning(event, '${j}', '${demiId}')">
        ${blocs.map(b => `
          <div class="bloc-planning" draggable="true" ondragstart="event.dataTransfer.setData('text/plain', '${b.id}')">
            <div class="libelle-bloc">${esc(b.libelle)}</div>
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
        🗒 = annotation réservée à l'encadrement (ex. présence infirmier), jamais visible du stagiaire.</div>
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
  $('planning-form').innerHTML = `
    <div class="carte" style="background:#f7f7f9">
      <h3>${b ? 'Modifier le bloc' : 'Nouveau bloc'} — ${esc(jourVal)} ${demiVal === 'matin' ? 'matin' : 'après-midi'}</h3>
      <label>Thématique / activité (visible du stagiaire)</label>
      <input id="pf-libelle" value="${b ? esc(b.libelle) : ''}">
      <label>Annotation formateur (facultatif, jamais visible du stagiaire)</label>
      <textarea id="pf-annotation">${b && b.annotation ? esc(b.annotation) : ''}</textarea>
      <button class="btn" onclick="enregistrerBlocPlanning(${blocId || 'null'}, '${jourVal}', '${demiVal}')">Enregistrer</button>
      <button class="btn secondaire" onclick="$('planning-form').innerHTML=''">Annuler</button>
    </div>`;
}

async function enregistrerBlocPlanning(blocId, jour, demi) {
  const libelle = $('pf-libelle').value.trim();
  if (!libelle) return toast('Thématique obligatoire', false);
  const annotation = $('pf-annotation').value.trim() || null;
  if (blocId) {
    const { error } = await sb.from('blocs_planning').update({ libelle, annotation }).eq('id', blocId);
    if (error) return toast(error.message, false);
  } else {
    const ordre = _blocsPlanningCellule(jour, demi).length;
    const { error } = await sb.from('blocs_planning').insert({
      session_id: S.session.id, jour, demi_journee: demi, ordre, libelle, annotation,
    });
    if (error) return toast(error.message, false);
  }
  await chargerDonneesSession(S.session.id);
  toast('Bloc enregistré');
  ongletPlanning();
}

async function supprimerBlocPlanning(blocId) {
  if (!confirm('Supprimer ce bloc ?')) return;
  const { error } = await sb.from('blocs_planning').delete().eq('id', blocId);
  if (error) return toast(error.message, false);
  await chargerDonneesSession(S.session.id);
  ongletPlanning();
}

async function deposerBlocPlanning(ev, jour, demi) {
  ev.preventDefault();
  ev.currentTarget.classList.remove('survol');
  const blocId = parseInt(ev.dataTransfer.getData('text/plain'), 10);
  if (!blocId) return;
  const ordre = _blocsPlanningCellule(jour, demi).length;
  const { error } = await sb.from('blocs_planning').update({ jour, demi_journee: demi, ordre }).eq('id', blocId);
  if (error) return toast(error.message, false);
  await chargerDonneesSession(S.session.id);
  ongletPlanning();
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
      <tr><th>Jour</th><th>Matin</th><th>Après-midi</th></tr>
      ${lignes}
    </table></div>
  </div>`;
}
