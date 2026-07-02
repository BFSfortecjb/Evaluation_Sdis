// app.js — LE MÉTIER. Écrans, listes, formulaires. C'est ici qu'on travaille.
// Dépend de core.js (sb, S, show, $, esc, toast, chargerFormation).

const NIVEAUX = ['A+', 'A', 'ECA', 'NA', 'NE'];
const NIV_CLASSE = { 'A+': 'Aplus', 'A': 'A', 'ECA': 'ECA', 'NA': 'NA', 'NE': 'NE' };
const JOURS = ['J1', 'J2', 'J3', 'J4', 'J5'];

// ============================================================
// ACCUEIL STAFF — liste des sessions + création
// ============================================================
async function ecranAccueilStaff() {
  show('ecran-staff-accueil');
  const { data: sessions, error } = await sb.from('sessions')
    .select('*, formations(code, libelle)').order('created_at', { ascending: false });
  if (error) return toast(error.message, false);

  $('staff-sessions').innerHTML = sessions.length ? sessions.map(s => `
    <button class="btn-liste" onclick="ouvrirSession('${s.id}')">
      <b>${esc(s.formations.libelle)}</b> — ${esc(s.lieu || '')}
      <span class="badge">${esc(s.statut)}</span><br>
      <small>${esc(s.date_debut || '')} → ${esc(s.date_fin || '')} · code stagiaire : <b>${esc(s.code_acces)}</b></small>
    </button>`).join('')
    : '<p class="info">Aucune session pour le moment.</p>';

  // Création réservée RP et GFOR
  if (S.user.role === 'rp' || S.user.role === 'gfor') {
    const { data: formations } = await sb.from('formations').select('*').eq('actif', true);
    $('staff-nouvelle-session').innerHTML = `
      <h3>Nouvelle session</h3>
      <div class="ligne">
        <div><label>Formation</label>
          <select id="ns-formation">${formations.map(f => `<option value="${f.id}" data-code="${esc(f.code)}">${esc(f.libelle)}</option>`).join('')}</select></div>
        <div><label>Lieu (CIS)</label><input id="ns-lieu" placeholder="ex : CIS BANNALEC"></div>
      </div>
      <div class="ligne">
        <div><label>Date début</label><input id="ns-debut" type="date"></div>
        <div><label>Date fin</label><input id="ns-fin" type="date"></div>
      </div>
      <label>Responsable pédagogique</label><input id="ns-resp" value="${esc(S.user.nom)}">
      <button class="btn" onclick="creerSession()">Créer la session</button>`;
  } else {
    $('staff-nouvelle-session').innerHTML = '';
  }
}

async function creerSession() {
  const sel = $('ns-formation');
  const fCode = sel.selectedOptions[0].dataset.code;
  const code = fCode + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const { data, error } = await sb.from('sessions').insert({
    formation_id: Number(sel.value),
    code_acces: code,
    lieu: $('ns-lieu').value.trim(),
    date_debut: $('ns-debut').value || null,
    date_fin: $('ns-fin').value || null,
    responsable: $('ns-resp').value.trim(),
  }).select().single();
  if (error) return toast(error.message, false);
  toast('Session créée — code stagiaire : ' + code);
  ouvrirSession(data.id);
}

// ============================================================
// SESSION — chargement des données + onglets
// ============================================================
async function chargerDonneesSession(sessionId) {
  const [stag, form, pass, equi, evals, autos] = await Promise.all([
    sb.from('stagiaires').select('*').eq('session_id', sessionId).order('nom'),
    sb.from('session_formateurs').select('*').eq('session_id', sessionId).order('nom'),
    sb.from('passages').select('*').eq('session_id', sessionId).order('numero'),
    sb.from('passage_equipiers').select('*, passages!inner(session_id)').eq('passages.session_id', sessionId),
    sb.from('evaluations').select('*, passages!inner(session_id)').eq('passages.session_id', sessionId),
    sb.from('autoevaluations').select('*, passages!inner(session_id)').eq('passages.session_id', sessionId),
  ]);
  for (const r of [stag, form, pass, equi, evals, autos]) if (r.error) throw r.error;
  S.data = {
    stagiaires: stag.data, formateurs: form.data, passages: pass.data,
    equipiers: equi.data, evaluations: evals.data, autoevaluations: autos.data,
  };
}

async function ouvrirSession(sessionId) {
  const { data: sess, error } = await sb.from('sessions').select('*, formations(libelle)').eq('id', sessionId).single();
  if (error) return toast(error.message, false);
  S.session = sess;
  await chargerFormation(sess.formation_id);
  await chargerDonneesSession(sessionId);

  $('session-titre').textContent = sess.formations.libelle + ' — ' + (sess.lieu || '');
  $('session-infos').textContent =
    (sess.date_debut || '?') + ' → ' + (sess.date_fin || '?') +
    ' · Responsable : ' + (sess.responsable || '?') +
    ' · Code stagiaire : ' + sess.code_acces;

  const onglets = [
    ['stagiaires', 'Stagiaires'], ['formateurs', 'Formateurs'], ['garde', 'Feuille de garde'],
    ['evaluations', 'Évaluations'], ['validation', 'Validation'], ['comparatif', 'Comparatif'],
  ];
  $('session-onglets').innerHTML = onglets.map(([id, lbl]) =>
    `<button id="ong-${id}" onclick="ongletSession('${id}')">${lbl}</button>`).join('');
  show('ecran-session');
  ongletSession(S.user.role === 'formateur' ? 'evaluations' : 'stagiaires');
}

function ongletSession(id) {
  document.querySelectorAll('#session-onglets button').forEach(b => b.classList.remove('actif'));
  $('ong-' + id).classList.add('actif');
  ({ stagiaires: ongletStagiaires, formateurs: ongletFormateurs, garde: ongletGarde,
     evaluations: ongletEvaluations, validation: ongletValidation, comparatif: ongletComparatif }[id])();
}

// ---------- Onglet Stagiaires ----------
function ongletStagiaires() {
  const lignes = S.data.stagiaires.map(s => `
    <tr><td>${esc(s.nom)}</td><td>${esc(s.prenom)}</td><td>${esc(s.matricule || '')}</td><td>${esc(s.cis || '')}</td>
    <td><button class="btn petit secondaire" onclick="supprStagiaire(${s.id})">✕</button></td></tr>`).join('');
  $('session-contenu').innerHTML = `
    <div class="carte">
      <h2>Stagiaires (${S.data.stagiaires.length})</h2>
      <div class="table-scroll"><table>
        <tr><th>Nom</th><th>Prénom</th><th>Matricule</th><th>CIS</th><th></th></tr>${lignes}
      </table></div>
      <h3>Ajouter un stagiaire</h3>
      <div class="ligne">
        <div><label>Nom</label><input id="st-nom"></div>
        <div><label>Prénom</label><input id="st-prenom"></div>
      </div>
      <div class="ligne">
        <div><label>Matricule</label><input id="st-mat"></div>
        <div><label>CIS de rattachement</label><input id="st-cis"></div>
      </div>
      <button class="btn" onclick="ajouterStagiaire()">Ajouter</button>
    </div>`;
}

async function ajouterStagiaire() {
  const nom = $('st-nom').value.trim(), prenom = $('st-prenom').value.trim();
  if (!nom || !prenom) return toast('Nom et prénom requis', false);
  const { error } = await sb.from('stagiaires').insert({
    session_id: S.session.id, nom, prenom,
    matricule: $('st-mat').value.trim() || null, cis: $('st-cis').value.trim() || null,
  });
  if (error) return toast(error.message, false);
  await chargerDonneesSession(S.session.id); ongletStagiaires(); toast('Stagiaire ajouté');
}

async function supprStagiaire(id) {
  if (!confirm('Supprimer ce stagiaire et toutes ses évaluations ?')) return;
  const { error } = await sb.from('stagiaires').delete().eq('id', id);
  if (error) return toast(error.message, false);
  await chargerDonneesSession(S.session.id); ongletStagiaires();
}

// ---------- Onglet Formateurs ----------
function ongletFormateurs() {
  $('session-contenu').innerHTML = `
    <div class="carte">
      <h2>Équipe pédagogique (${S.data.formateurs.length})</h2>
      ${S.data.formateurs.map(f => `<div class="bloc-comp">${esc(f.nom)}
        <button class="btn petit secondaire" style="float:right" onclick="supprFormateur(${f.id})">✕</button></div>`).join('')}
      <h3>Ajouter un formateur</h3>
      <input id="fo-nom" placeholder="Prénom NOM">
      <button class="btn" onclick="ajouterFormateur()">Ajouter</button>
    </div>`;
}

async function ajouterFormateur() {
  const nom = $('fo-nom').value.trim();
  if (!nom) return toast('Nom requis', false);
  const { error } = await sb.from('session_formateurs').insert({ session_id: S.session.id, nom });
  if (error) return toast(error.message, false);
  await chargerDonneesSession(S.session.id); ongletFormateurs(); toast('Formateur ajouté');
}

async function supprFormateur(id) {
  const { error } = await sb.from('session_formateurs').delete().eq('id', id);
  if (error) return toast(error.message, false);
  await chargerDonneesSession(S.session.id); ongletFormateurs();
}

// ---------- Onglet Feuille de garde ----------
function ongletGarde() {
  const nomStag = id => { const s = S.data.stagiaires.find(x => x.id === id); return s ? s.prenom + ' ' + s.nom : '?'; };
  const lignes = S.data.passages.map(p => {
    const eq = S.data.equipiers.filter(e => e.passage_id === p.id);
    const theme = S.formation.themes.find(t => t.id === p.theme_id);
    return `<tr>
      <td>${p.numero}</td><td>${esc(p.jour)}</td><td>${esc(theme ? theme.libelle : '')}</td>
      <td>${esc(p.sujet || '')}</td><td>${esc(p.evaluateur || '')}</td>
      <td>${eq.map(e => esc(nomStag(e.stagiaire_id)) + (e.evalue ? '' : ' <small>(non évalué)</small>')).join('<br>')}</td>
      <td><button class="btn petit secondaire" onclick="supprPassage(${p.id})">✕</button></td></tr>`;
  }).join('');

  $('session-contenu').innerHTML = `
    <div class="carte">
      <h2>Feuille de garde — passages prévus</h2>
      <div class="table-scroll"><table>
        <tr><th>N°</th><th>Jour</th><th>Thème</th><th>Sujet</th><th>Évaluateur</th><th>Équipiers</th><th></th></tr>
        ${lignes}
      </table></div>
      <h3>Programmer un passage</h3>
      <div class="ligne">
        <div><label>Jour</label><select id="pa-jour">${JOURS.map(j => `<option>${j}</option>`).join('')}</select></div>
        <div><label>Thème</label><select id="pa-theme">${S.formation.themes.map(t => `<option value="${t.id}">${esc(t.libelle)}</option>`).join('')}</select></div>
      </div>
      <div class="ligne">
        <div><label>Sujet / cas concret</label>
          <input id="pa-sujet" list="liste-cas" placeholder="libre ou choisir">
          <datalist id="liste-cas">${S.formation.cas.map(c => `<option value="${esc(c.libelle)}">`).join('')}</datalist></div>
        <div><label>Évaluateur</label>
          <select id="pa-eval">${S.data.formateurs.map(f => `<option>${esc(f.nom)}</option>`).join('')}</select></div>
      </div>
      <label>Équipiers du passage (cocher « évalué » pour ceux qui comptent pour la certification)</label>
      ${S.data.stagiaires.map(s => `
        <div class="bloc-comp">
          <input type="checkbox" id="pa-eq-${s.id}" style="width:auto"> ${esc(s.prenom)} ${esc(s.nom)}
          &nbsp;·&nbsp; <input type="checkbox" id="pa-ev-${s.id}" checked style="width:auto"> <small>évalué</small>
        </div>`).join('')}
      <button class="btn" onclick="ajouterPassage()">Programmer</button>
    </div>`;
}

async function ajouterPassage() {
  const equipiers = S.data.stagiaires.filter(s => $('pa-eq-' + s.id).checked);
  if (!equipiers.length) return toast('Sélectionner au moins un équipier', false);
  const numero = Math.max(0, ...S.data.passages.map(p => p.numero)) + 1;
  const { data: passage, error } = await sb.from('passages').insert({
    session_id: S.session.id, numero,
    jour: $('pa-jour').value, theme_id: Number($('pa-theme').value),
    sujet: $('pa-sujet').value.trim() || null, evaluateur: $('pa-eval').value || null,
  }).select().single();
  if (error) return toast(error.message, false);
  const { error: e2 } = await sb.from('passage_equipiers').insert(
    equipiers.map(s => ({ passage_id: passage.id, stagiaire_id: s.id, evalue: $('pa-ev-' + s.id).checked })));
  if (e2) return toast(e2.message, false);
  await chargerDonneesSession(S.session.id); ongletGarde(); toast('Passage n°' + numero + ' programmé');
}

async function supprPassage(id) {
  if (!confirm('Supprimer ce passage et ses évaluations ?')) return;
  const { error } = await sb.from('passages').delete().eq('id', id);
  if (error) return toast(error.message, false);
  await chargerDonneesSession(S.session.id); ongletGarde();
}

// ---------- Onglet Évaluations (saisie formateur) ----------
function ongletEvaluations() {
  const nomStag = id => { const s = S.data.stagiaires.find(x => x.id === id); return s ? s.prenom + ' ' + s.nom : '?'; };
  const blocs = S.data.passages.map(p => {
    const theme = S.formation.themes.find(t => t.id === p.theme_id);
    const eq = S.data.equipiers.filter(e => e.passage_id === p.id && e.evalue);
    if (!eq.length) return '';
    return `<div class="carte">
      <h3>Passage n°${p.numero} · ${esc(p.jour)} · ${esc(theme ? theme.libelle : '')} ${p.sujet ? '· ' + esc(p.sujet) : ''}</h3>
      <div class="info">Évaluateur : ${esc(p.evaluateur || '—')}</div>
      ${eq.map(e => {
        const fait = S.data.evaluations.find(ev => ev.passage_id === p.id && ev.stagiaire_id === e.stagiaire_id);
        return `<button class="btn-liste" onclick="formEvaluation(${p.id}, ${e.stagiaire_id})">
          ${esc(nomStag(e.stagiaire_id))} ${fait ? '<span class="niv niv-A">évalué ✓</span>' : '<span class="niv niv-NE">à évaluer</span>'}
        </button>`;
      }).join('')}
    </div>`;
  }).join('');
  $('session-contenu').innerHTML = blocs || '<div class="carte"><p class="info">Aucun passage programmé — voir l\'onglet Feuille de garde.</p></div>';
}

let _evalCourante = null; // {passageId, stagiaireId, notes:{}}

function formEvaluation(passageId, stagiaireId) {
  const p = S.data.passages.find(x => x.id === passageId);
  const s = S.data.stagiaires.find(x => x.id === stagiaireId);
  const existante = S.data.evaluations.find(ev => ev.passage_id === passageId && ev.stagiaire_id === stagiaireId);
  _evalCourante = { passageId, stagiaireId, notes: existante ? { ...existante.notes } : {} };

  $('session-contenu').innerHTML = `
    <div class="carte">
      <span class="lien-retour" onclick="ongletEvaluations()">← Retour aux passages</span>
      <h2>Évaluation — ${esc(s.prenom)} ${esc(s.nom)}</h2>
      <div class="info">Passage n°${p.numero} · ${esc(p.jour)} · A+ acquis avec analyse / A acquis / ECA en cours / NA non acquis / NE non évalué</div>
      ${S.formation.competences.map(c => `
        <div class="bloc-comp">
          <div class="libelle"><span class="code">${esc(c.code)}</span> — ${esc(c.libelle)}</div>
          <div class="choix-niv" id="niv-${c.id}">
            ${NIVEAUX.map(n => `<button onclick="choisirNiveau(${c.id}, '${n}')"
              class="${_evalCourante.notes[c.id] === n ? 'sel-' + NIV_CLASSE[n] : ''}">${n}</button>`).join('')}
          </div>
        </div>`).join('')}
      <div class="ligne">
        <div><label>Ressenti formateur (0 à 5)</label>
          <select id="ev-ressenti">${[0,1,2,3,4,5].map(n => `<option ${existante && existante.ressenti_formateur === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      </div>
      <label>APP à proposer 1</label><input id="ev-app1" value="${esc(existante?.app1 || '')}">
      <label>APP à proposer 2</label><input id="ev-app2" value="${esc(existante?.app2 || '')}">
      <label>APP à proposer 3</label><input id="ev-app3" value="${esc(existante?.app3 || '')}">
      <label>Commentaire</label><textarea id="ev-comm">${esc(existante?.commentaire || '')}</textarea>
      <button class="btn" onclick="enregistrerEvaluation()">Enregistrer l'évaluation</button>
    </div>`;
}

function choisirNiveau(compId, niveau) {
  _evalCourante.notes[compId] = niveau;
  const bloc = $('niv-' + compId);
  bloc.querySelectorAll('button').forEach(b => b.className = '');
  const idx = NIVEAUX.indexOf(niveau);
  bloc.querySelectorAll('button')[idx].className = 'sel-' + NIV_CLASSE[niveau];
}

async function enregistrerEvaluation() {
  const manquantes = S.formation.competences.filter(c => !_evalCourante.notes[c.id]);
  if (manquantes.length) return toast('Compétences non renseignées : ' + manquantes.map(c => c.code).join(', ') + ' (utiliser NE si non évaluée)', false);
  const { error } = await sb.from('evaluations').upsert({
    passage_id: _evalCourante.passageId, stagiaire_id: _evalCourante.stagiaireId,
    formateur: S.user ? S.user.nom : null,
    notes: _evalCourante.notes,
    ressenti_formateur: Number($('ev-ressenti').value),
    app1: $('ev-app1').value.trim() || null, app2: $('ev-app2').value.trim() || null,
    app3: $('ev-app3').value.trim() || null, commentaire: $('ev-comm').value.trim() || null,
  }, { onConflict: 'passage_id,stagiaire_id' });
  if (error) return toast(error.message, false);
  await chargerDonneesSession(S.session.id);
  toast('Évaluation enregistrée'); ongletEvaluations();
}

// ---------- Onglet Validation (règles RIOFE) ----------
function bilanStagiaire(stagiaireId) {
  const evals = S.data.evaluations.filter(e => e.stagiaire_id === stagiaireId);
  const bilan = {};
  for (const c of S.formation.competences) {
    let acquis = 0, eca = 0, na = 0;
    for (const ev of evals) {
      const n = ev.notes[c.id];
      if (n === 'A' || n === 'A+') acquis++;
      else if (n === 'ECA') eca++;
      else if (n === 'NA') na++;
    }
    // Règle RIOFE : case grisée = « acquise » 2 fois ; case blanche = a minima ECA
    let statut;
    if (c.grisee) statut = acquis >= 2 ? 'Validé' : (acquis + eca > 0 ? 'En cours' : '—');
    else statut = acquis > 0 || eca > 0 ? 'Validé' : (na > 0 ? 'Non acquis' : '—');
    if (na > 0 && statut !== 'Validé') statut = 'Alerte NA';
    bilan[c.id] = { acquis, eca, na, statut };
  }
  return { bilan, nbPassages: evals.length };
}

function ongletValidation() {
  const comps = S.formation.competences;
  const lignes = S.data.stagiaires.map(s => {
    const { bilan, nbPassages } = bilanStagiaire(s.id);
    const cellules = comps.map(c => {
      const b = bilan[c.id];
      const cls = b.statut === 'Validé' ? 'statut-valide' : (b.statut === 'En cours' ? 'statut-eca' : (b.statut === '—' ? '' : 'statut-na'));
      return `<td class="${cls}" title="acquis:${b.acquis} ECA:${b.eca} NA:${b.na}">${b.statut}<br><small>${b.acquis}A/${b.eca}E/${b.na}N</small></td>`;
    }).join('');
    const okMsp = nbPassages >= S.formation.nb_msp_min;
    return `<tr><td><b>${esc(s.prenom)} ${esc(s.nom)}</b><br>
      <small class="${okMsp ? 'statut-valide' : 'statut-na'}">${nbPassages}/${S.formation.nb_msp_min} MSP évaluées</small></td>${cellules}</tr>`;
  }).join('');

  $('session-contenu').innerHTML = `
    <div class="carte">
      <h2>Validation des compétences</h2>
      <div class="info">Règle RIOFE : compétence grisée = « acquise » (A ou A+) 2 fois minimum · ${S.formation.nb_msp_min} MSP évaluées minimum par stagiaire. Détail par case : nb Acquis / ECA / NA.</div>
      <div class="table-scroll"><table>
        <tr><th>Stagiaire</th>${comps.map(c => `<th title="${esc(c.libelle)}">${esc(c.code)}</th>`).join('')}</tr>
        ${lignes}
      </table></div>
    </div>`;
}

// ---------- Onglet Comparatif auto-éval / éval formateur ----------
function ongletComparatif() {
  $('session-contenu').innerHTML = `
    <div class="carte">
      <h2>Comparatif auto-évaluation / évaluation formateur</h2>
      <label>Stagiaire</label>
      <select id="cmp-stag" onchange="afficherComparatif(Number(this.value), 'cmp-zone')">
        <option value="">— choisir —</option>
        ${S.data.stagiaires.map(s => `<option value="${s.id}">${esc(s.prenom)} ${esc(s.nom)}</option>`).join('')}
      </select>
      <div id="cmp-zone"></div>
    </div>`;
}

function afficherComparatif(stagiaireId, zoneId) {
  if (!stagiaireId) return;
  const passages = S.data.equipiers
    .filter(e => e.stagiaire_id === stagiaireId)
    .map(e => S.data.passages.find(p => p.id === e.passage_id))
    .filter(Boolean).sort((a, b) => a.numero - b.numero);

  const blocs = passages.map(p => {
    const ev = S.data.evaluations.find(x => x.passage_id === p.id && x.stagiaire_id === stagiaireId);
    const auto = S.data.autoevaluations.find(x => x.passage_id === p.id && x.stagiaire_id === stagiaireId);
    const theme = S.formation.themes.find(t => t.id === p.theme_id);
    if (!ev && !auto) return '';
    const lignesEval = ev ? S.formation.competences.map(c => {
      const n = ev.notes[c.id];
      return n && n !== 'NE' ? `<tr><td>${esc(c.code)} ${esc(c.libelle.slice(0, 60))}…</td>
        <td><span class="niv niv-${NIV_CLASSE[n]}">${n}</span></td></tr>` : '';
    }).join('') : '';
    const lignesAuto = auto ? S.formation.criteres.map(cr => {
      const n = auto.notes[cr.id];
      return n ? `<tr><td>${esc(cr.libelle)}</td><td><b>${n}</b>/10</td></tr>` : '';
    }).join('') : '';
    return `<h3>Passage n°${p.numero} · ${esc(p.jour)} · ${esc(theme ? theme.libelle : '')}</h3>
      <div class="ligne">
        <div><b>Évaluation formateur</b> ${ev ? '(' + esc(ev.formateur || '') + ', ressenti ' + (ev.ressenti_formateur ?? '—') + '/5)' : ''}
          <table>${lignesEval || '<tr><td class="info">Pas encore saisie</td></tr>'}</table>
          ${ev && ev.commentaire ? `<p class="info">« ${esc(ev.commentaire)} »</p>` : ''}</div>
        <div><b>Auto-évaluation stagiaire</b> ${auto && auto.ressenti ? '(ressenti : ' + esc(auto.ressenti) + ')' : ''}
          <table>${lignesAuto || '<tr><td class="info">Pas encore saisie</td></tr>'}</table></div>
      </div>`;
  }).join('');
  $(zoneId).innerHTML = blocs || '<p class="info">Aucune évaluation pour ce stagiaire.</p>';
}

// ============================================================
// CÔTÉ STAGIAIRE
// ============================================================
async function ecranAccueilStagiaire() {
  await chargerDonneesSession(S.session.id);
  const stagiaireId = S.stagiaire.id;
  const mesPassages = S.data.equipiers
    .filter(e => e.stagiaire_id === stagiaireId)
    .map(e => S.data.passages.find(p => p.id === e.passage_id))
    .filter(Boolean).sort((a, b) => a.numero - b.numero);

  const blocs = mesPassages.map(p => {
    const theme = S.formation.themes.find(t => t.id === p.theme_id);
    const auto = S.data.autoevaluations.find(a => a.passage_id === p.id && a.stagiaire_id === stagiaireId);
    return `<button class="btn-liste" onclick="formAutoEval(${p.id})">
      Passage n°${p.numero} · ${esc(p.jour)} · ${esc(theme ? theme.libelle : '')}
      ${auto ? '<span class="niv niv-A">auto-éval faite ✓</span>' : '<span class="niv niv-NE">à faire</span>'}
    </button>`;
  }).join('');

  $('stagiaire-contenu').innerHTML = `
    <div class="carte">
      <h2>Mes passages</h2>
      ${blocs || '<p class="info">Aucun passage programmé pour toi pour le moment.</p>'}
    </div>
    <div class="carte">
      <h2>Mon comparatif</h2>
      <p class="info">Ton auto-évaluation face au regard du formateur, passage par passage.</p>
      <div id="stag-cmp"></div>
      <button class="btn secondaire" onclick="afficherComparatif(${stagiaireId}, 'stag-cmp')">Afficher</button>
    </div>`;
  show('ecran-stagiaire');
}

let _autoCourante = null;

function formAutoEval(passageId) {
  const p = S.data.passages.find(x => x.id === passageId);
  const existante = S.data.autoevaluations.find(a => a.passage_id === passageId && a.stagiaire_id === S.stagiaire.id);
  _autoCourante = { passageId, notes: existante ? { ...existante.notes } : {} };

  $('stagiaire-contenu').innerHTML = `
    <div class="carte">
      <span class="lien-retour" onclick="ecranAccueilStagiaire()">← Retour</span>
      <h2>Auto-évaluation — passage n°${p.numero}</h2>
      <div class="info">Niveau de maîtrise : 0 = aucune · 10 = totale. Ne renseigne que ce qui concerne ta mise en situation.</div>
      ${S.formation.criteres.map(cr => {
        const v = _autoCourante.notes[cr.id] || 0;
        return `<div class="bloc-crit">
          <div>${esc(cr.libelle)} — <span class="valeur" id="val-${cr.id}">${v || '—'}</span></div>
          <input type="range" min="0" max="10" value="${v}"
            oninput="majCurseur(${cr.id}, this.value)">
        </div>`;
      }).join('')}
      <label>Mon ressenti (un mot ou une phrase)</label>
      <input id="au-ressenti" value="${esc(existante?.ressenti || '')}" placeholder="ex : confiant, désemparé…">
      <button class="btn" onclick="enregistrerAutoEval()">Enregistrer mon auto-évaluation</button>
    </div>`;
  show('ecran-stagiaire');
}

function majCurseur(critId, valeur) {
  const v = Number(valeur);
  if (v === 0) delete _autoCourante.notes[critId];
  else _autoCourante.notes[critId] = v;
  $('val-' + critId).textContent = v || '—';
}

async function enregistrerAutoEval() {
  if (!Object.keys(_autoCourante.notes).length) return toast('Renseigner au moins un critère', false);
  const { error } = await sb.from('autoevaluations').upsert({
    passage_id: _autoCourante.passageId, stagiaire_id: S.stagiaire.id,
    notes: _autoCourante.notes, ressenti: $('au-ressenti').value.trim() || null,
  }, { onConflict: 'passage_id,stagiaire_id' });
  if (error) return toast(error.message, false);
  toast('Auto-évaluation enregistrée');
  ecranAccueilStagiaire();
}
