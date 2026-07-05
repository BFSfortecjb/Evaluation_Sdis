// app.js — LE MÉTIER. Écrans, listes, formulaires. C'est ici qu'on travaille.
// Dépend de core.js (sb, S, show, $, esc, toast, chargerFormation).

const NIVEAUX = ['A+', 'A', 'ECA', 'NA', 'NE'];
const NIV_CLASSE = { 'A+': 'Aplus', 'A': 'A', 'ECA': 'ECA', 'NA': 'NA', 'NE': 'NE' };
const JOURS = ['J1', 'J2', 'J3', 'J4', 'J5'];

// ============================================================
// ACCUEIL STAFF — tableau de bord + changement de vision
// ============================================================
function changerVision(role) {
  S.vision = role;
  S.stagiaire = null;
  if (role === 'stagiaire') return ecranChoixSessionVision();
  ecranAccueilStaff();
}

// Barème d'encadrement (RIOFE) : nb de formateurs requis selon le nb de stagiaires
function formateursRequis(f, nbStag) {
  const bar = f.bareme_formateurs || [];
  if (!bar.length) return 0;
  for (const t of bar) if (nbStag >= t.min && nbStag <= t.max) return t.formateurs;
  return nbStag < bar[0].min ? bar[0].formateurs : bar[bar.length - 1].formateurs;
}

function jauge(n, requis, libelle, max) {
  const ok = max ? n <= max && n > 0 : n >= requis;
  const base = max || requis;
  const pct = base ? Math.min(100, Math.round(n / base * 100)) : 0;
  return `<div class="jauge-bloc"><small>${libelle} : <b class="${ok ? 'statut-valide' : 'statut-na'}">${n}/${base}</b></small>
    <div class="jauge"><div style="width:${pct}%;background:${ok ? 'var(--ok)' : 'var(--warn)'}"></div></div></div>`;
}

function carteSession(s) {
  const f = s.formations;
  const reqF = formateursRequis(f, s._nbStag || f.nb_stagiaires_max);
  return `<div class="carte carte-session" style="border-left-color:${esc(f.couleur)}" onclick="ouvrirSession('${s.id}')">
    <span class="badge" style="background:${esc(f.couleur)};color:#fff">${esc(f.domaine)}</span>
    <b>${esc(f.libelle)}</b> — ${esc(s.lieu || 'lieu à définir')}
    <div class="info">${esc(s.date_debut || 'dates à définir')} → ${esc(s.date_fin || '')} · RP : ${esc(s.responsable || '—')} · code stagiaire : <b>${esc(s.code_acces)}</b></div>
    <div class="ligne" style="margin-top:8px">
      ${jauge(s._nbStag, null, 'Stagiaires', f.nb_stagiaires_max)}
      ${jauge(s.responsable ? 1 : 0, f.nb_rp_requis || 1, 'Resp. péda.')}
      ${jauge(s._nbForm, reqF, 'Formateurs FPS')}
    </div>
  </div>`;
}

function majMenu(actif) {
  const m = $('menu-gauche');
  if (!S.user || S.vision === 'stagiaire') { m.style.display = 'none'; return; }
  const peutCreer = S.vision === 'rp' || S.vision === 'gfor';
  m.innerHTML = `<button class="${actif === 'dash' ? 'actif' : ''}" onclick="ecranAccueilStaff()">🏠 Tableau de bord</button>` +
    (peutCreer ? `<button class="${actif === 'new' ? 'actif' : ''}" onclick="ecranNouvelleSession()">➕ Nouvelle session</button>` : '') +
    `<button class="${actif === 'apt' ? 'actif' : ''}" onclick="ecranGestionFormateurs()">👨‍🏫 Formateurs</button>`;
  m.style.display = '';
}

const GRADES = ['SAP', 'CAP', 'CCH', 'SGT', 'SCH', 'ADJ', 'ADC', 'LTN', 'CNE', 'CDT', 'LCL', 'COL', 'ISP'];
const DOMAINES_COMP = ['INCENDIE', 'PPBE', 'SSUAP', 'SR'];
const STATUTS = ['SPV', 'SPP', 'PATS'];
// Liste des CIS du Finistère — à ajuster librement ici si besoin
const CIS_29 = ['AUDIERNE', 'BANNALEC', 'BREST', 'BRIEC', 'CAMARET-SUR-MER', 'CARHAIX', 'CHATEAULIN',
  'CHATEAUNEUF-DU-FAOU', 'CLEDER', 'CLOHARS-CARNOET', 'CONCARNEAU', 'CROZON', 'DE L\'AVEN', 'DOUARNENEZ',
  'FOUESNANT-PLEUVEN', 'GUERLESQUIN', 'GUIPAVAS', 'HUELGOAT', 'ILE DE BATZ', 'ILE DE SEIN', 'ILE MOLENE',
  'OUESSANT', 'LANDERNEAU', 'LANDIVISIAU', 'LANMEUR', 'LANNILIS', 'LE CONQUET', 'LE FAOU', 'LE GUILVINEC',
  'LESNEVEN', 'MOELAN-SUR-MER', 'MORLAIX', 'PLABENNEC', 'PLEYBEN', 'PLEYBER-CHRIST', 'PLONEOUR-LANVERN',
  'PLOUDALMEZEAU', 'PLOUESCAT', 'PLOUGASNOU', 'PLOUGASTEL-DAOULAS', 'PLOUGUERNEAU', 'PLOUIGNEAU',
  'PLOZEVET', 'PONT-AVEN', 'PONT-CROIX', 'PONT-L\'ABBE', 'QUERRIEN', 'QUIMPER', 'QUIMPERLE', 'ROSCOFF',
  'ROSPORDEN', 'SAINT-POL-DE-LEON', 'SAINT-RENAN', 'SCAER', 'SIZUN'].map(c => 'CIS ' + c);

function selectCIS(id, valeur) {
  return `<select id="${id}"><option value="">— CIS —</option>
    ${CIS_29.map(c => `<option ${c === valeur ? 'selected' : ''}>${c}</option>`).join('')}</select>`;
}

// Une même personne peut cumuler plusieurs niveaux (formateur / RP / for de for)
// dans un même domaine, chacun avec sa propre date de fin de validité.
function couleurRole(role) {
  return role === 'rp' ? '#1565c0' : role === 'for_de_for' ? '#6a1b9a' : '#607d8b';
}
function libelleRole(role) {
  return role === 'rp' ? 'RP' : role === 'for_de_for' ? 'For de For' : 'Form.';
}

function badgeQualif(q, suppr) {
  const auj = new Date().toISOString().slice(0, 10);
  const ok = q.fin_validite >= auj;
  return `<span class="badge" style="background:${couleurRole(q.role)};color:#fff;margin:2px">
    ${q.domaine} ${libelleRole(q.role)} <span style="opacity:.85">→ ${q.fin_validite}</span>${ok ? '' : ' ⚠'}
    ${suppr ? `<a onclick="event.stopPropagation();supprQualification(${q.id})" style="cursor:pointer;color:#fff;font-weight:bold"> ✕</a>` : ''}
  </span>`;
}

// ============================================================
// NOUVELLE SESSION — le RP est filtré selon le domaine de la formation
// ============================================================
async function ecranNouvelleSession() {
  majMenu('new');
  show('ecran-staff-accueil');
  const [f, apt] = await Promise.all([
    sb.from('formations').select('*').eq('actif', true),
    sb.from('aptitudes').select('*, qualifications(*)'),
  ]);
  if (f.error) return toast(f.error.message, false);
  window._aptRP = apt.data || [];
  $('staff-dashboard').innerHTML = `<div class="carte">
    <h2>Nouvelle session</h2>
    <div class="ligne">
      <div><label>Formation</label>
        <select id="ns-formation" onchange="majListeRP()">${f.data.map(x =>
          `<option value="${x.id}" data-code="${esc(x.code)}" data-dom="${esc(x.domaine_competence || '')}">${esc(x.libelle)}</option>`).join('')}</select></div>
      <div><label>Lieu</label>${selectCIS('ns-lieu')}</div>
    </div>
    <div class="ligne">
      <div><label>Date début</label><input id="ns-debut" type="date"></div>
      <div><label>Date fin</label><input id="ns-fin" type="date"></div>
    </div>
    <label>Responsable pédagogique (RP qualifié pour ce domaine)</label>
    <select id="ns-resp"></select>
    <button class="btn" onclick="creerSession()">Créer la session</button>
  </div>`;
  majListeRP();
}

function majListeRP() {
  const dom = $('ns-formation').selectedOptions[0].dataset.dom;
  const rps = window._aptRP
    .map(a => ({ a, q: (a.qualifications || []).find(q => q.role === 'rp' && (!dom || q.domaine === dom)) }))
    .filter(x => x.q);
  $('ns-resp').innerHTML = `<option value="">— À définir —</option>` +
    rps.map(x => `<option value="${x.a.id}" data-fin="${x.q.fin_validite}" data-nom="${esc(x.a.prenom + ' ' + x.a.nom)}">
      ${esc(x.a.grade || '')} ${esc(x.a.prenom)} ${esc(x.a.nom)} — RP ${esc(x.q.domaine)} valide jusqu'au ${x.q.fin_validite}</option>`).join('');
}

// ============================================================
// LISTE D'APTITUDE = GESTION DES UTILISATEURS (GFor)
// Une personne + des qualifications par domaine (rôle et validité propres)
// ============================================================
let _qualisEnCours = [];

async function ecranGestionFormateurs() {
  majMenu('apt');
  show('ecran-staff-accueil');
  _qualisEnCours = [];
  const { data: apt, error } = await sb.from('aptitudes').select('*, qualifications(*)').order('nom');
  if (error) return toast(error.message, false);
  const estGfor = S.vision === 'gfor';
  window._apt = apt || [];

  const lignes = (apt || []).map(a => `<tr>
      <td>${esc(a.matricule || '')}</td><td>${esc(a.grade || '')}</td>
      <td><b>${esc(a.nom)}</b> ${esc(a.prenom)}</td>
      <td>${esc(a.statut || '')}</td><td>${esc(a.cis || '')}</td>
      <td>${esc(a.email || '')}</td>
      <td>${(a.qualifications || []).map(q => badgeQualif(q, estGfor)).join(' ') || '<span class="info">aucune</span>'}</td>
      ${estGfor ? `<td style="white-space:nowrap">
        <button class="btn petit secondaire" title="Modifier ses informations" onclick="ecranModifierAptitude(${a.id})">✏️</button>
        ${a.email ? `<button class="btn petit secondaire" title="Réinitialiser le mot de passe" onclick="resetMdp('${esc(a.email)}')">🔑</button>` : ''}
        <button class="btn petit secondaire" onclick="supprAptitude(${a.id})">✕</button></td>` : ''}
    </tr>`).join('');

  $('staff-dashboard').innerHTML = `<div class="carte">
    <h2>Liste d'aptitude — formateurs et RP (${(apt || []).length})</h2>
    <div class="info">Une personne peut être RP dans un domaine et simple formateur dans un autre, chaque qualification a sa date de fin de validité. L'email sert de compte utilisateur (« Première connexion » sur l'écran d'accueil). 🔑 = réinitialisation du mot de passe.</div>
    <div class="table-scroll"><table>
      <tr><th>Matricule</th><th>Grade</th><th>Nom Prénom</th><th>Statut</th><th>CIS</th><th>Email</th><th>Qualifications</th>${estGfor ? '<th></th>' : ''}</tr>
      ${lignes}
    </table></div>
    ${estGfor ? `
      <h3>Ajout individuel</h3>
      <div class="ligne">
        <div><label>Matricule</label><input id="ap-mat"></div>
        <div><label>Grade</label><select id="ap-grade">${GRADES.map(g => `<option>${g}</option>`).join('')}</select></div>
        <div><label>Statut</label><select id="ap-statut">${STATUTS.map(s => `<option>${s}</option>`).join('')}</select></div>
      </div>
      <div class="ligne">
        <div><label>Nom</label><input id="ap-nom"></div>
        <div><label>Prénom</label><input id="ap-prenom"></div>
      </div>
      <div class="ligne">
        <div><label>CIS de rattachement</label>${selectCIS('ap-cis')}</div>
        <div><label>Email (compte utilisateur)</label><input id="ap-email" type="email"></div>
      </div>
      <label>Qualifications de la personne</label>
      <div class="ligne">
        <div><label>Domaine</label><select id="ap-q-dom">${DOMAINES_COMP.map(d => `<option>${d}</option>`).join('')}</select></div>
        <div><label>Rôle</label><select id="ap-q-role"><option value="formateur">Formateur</option><option value="rp">RP</option><option value="for_de_for">For de For</option></select></div>
        <div><label>Fin de validité</label><input id="ap-q-fin" type="date"></div>
        <div style="align-self:flex-end"><button class="btn petit" onclick="ajouterQualifEnCours()">➕ Ajouter</button></div>
      </div>
      <div id="ap-q-liste" style="margin:8px 0"></div>
      <button class="btn" onclick="ajouterAptitude()">Enregistrer la personne</button>

      <h3>Ajouter une qualification à une personne existante</h3>
      <div class="ligne">
        <div><label>Personne</label><select id="qx-apt">${(apt || []).map(a => `<option value="${a.id}">${esc(a.nom)} ${esc(a.prenom)}</option>`).join('')}</select></div>
        <div><label>Domaine</label><select id="qx-dom">${DOMAINES_COMP.map(d => `<option>${d}</option>`).join('')}</select></div>
        <div><label>Rôle</label><select id="qx-role"><option value="formateur">Formateur</option><option value="rp">RP</option><option value="for_de_for">For de For</option></select></div>
        <div><label>Fin de validité</label><input id="qx-fin" type="date"></div>
        <div style="align-self:flex-end"><button class="btn petit" onclick="ajouterQualifExistant()">➕ Ajouter</button></div>
      </div>

      <h3>Import Excel</h3>
      <p class="info">Une ligne par qualification (une même personne peut donc avoir plusieurs lignes). Colonnes : Matricule, Nom, Prénom, Grade, Statut, CIS, Email, Domaine, Rôle, Fin de validité.</p>
      <button class="btn secondaire" onclick="telechargerModeleAptitude()">📄 Télécharger le modèle</button>
      <label style="margin-top:10px">Fichier à importer (.xlsx)</label>
      <input type="file" accept=".xlsx,.xls,.csv" onchange="importerAptitudes(this)">`
    : `<p class="info">Liste gérée par le Groupement Formation (vision GFor).</p>`}
  </div>`;
}

function _rendreQualisEnCours() {
  $('ap-q-liste').innerHTML = _qualisEnCours.map((q, i) =>
    `<span class="badge" style="background:${couleurRole(q.role)};color:#fff;margin:2px">
      ${q.domaine} ${libelleRole(q.role)} → ${q.fin_validite}
      <a onclick="_qualisEnCours.splice(${i},1);ajouterQualifEnCours._maj()" style="cursor:pointer;color:#fff"> ✕</a></span>`).join('');
}
function ajouterQualifEnCours() {
  const fin = $('ap-q-fin').value;
  if (!fin) return toast('Renseigner la fin de validité', false);
  const dom = $('ap-q-dom').value;
  const role = $('ap-q-role').value;
  // Une même personne peut cumuler plusieurs niveaux (formateur / RP / for de for) dans un même domaine ;
  // seul le doublon exact domaine+rôle est bloqué.
  if (_qualisEnCours.some(q => q.domaine === dom && q.role === role)) return toast('Ce niveau (' + libelleRole(role) + ') est déjà ajouté pour ce domaine', false);
  _qualisEnCours.push({ domaine: dom, role, fin_validite: fin });
  _rendreQualisEnCours();
}
ajouterQualifEnCours._maj = _rendreQualisEnCours;

async function ajouterAptitude() {
  const nom = $('ap-nom').value.trim(), prenom = $('ap-prenom').value.trim();
  if (!nom || !prenom) return toast('Nom et prénom requis', false);
  if (!_qualisEnCours.length) return toast('Ajouter au moins une qualification (domaine + rôle + validité)', false);
  const { data: pers, error } = await sb.from('aptitudes').insert({
    matricule: $('ap-mat').value.trim() || null, grade: $('ap-grade').value,
    statut: $('ap-statut').value, nom, prenom,
    cis: $('ap-cis').value || null,
    email: $('ap-email').value.trim().toLowerCase() || null,
  }).select().single();
  if (error) return toast(error.message, false);
  const { error: e2 } = await sb.from('qualifications').insert(
    _qualisEnCours.map(q => ({ ...q, aptitude_id: pers.id })));
  if (e2) return toast(e2.message, false);
  toast('Personne enregistrée avec ' + _qualisEnCours.length + ' qualification(s)');
  ecranGestionFormateurs();
}

async function ajouterQualifExistant() {
  const fin = $('qx-fin').value;
  if (!fin) return toast('Renseigner la fin de validité', false);
  const { error } = await sb.from('qualifications').upsert({
    aptitude_id: Number($('qx-apt').value), domaine: $('qx-dom').value,
    role: $('qx-role').value, fin_validite: fin,
  }, { onConflict: 'aptitude_id,domaine,role' });
  if (error) return toast(error.message, false);
  toast('Qualification ajoutée'); ecranGestionFormateurs();
}

async function supprQualification(id) {
  const { error } = await sb.from('qualifications').delete().eq('id', id);
  if (error) return toast(error.message, false);
  ecranGestionFormateurs();
}

async function supprAptitude(id) {
  if (!confirm('Retirer cette personne (et toutes ses qualifications) de la liste d\'aptitude ?')) return;
  const { error } = await sb.from('aptitudes').delete().eq('id', id);
  if (error) return toast(error.message, false);
  ecranGestionFormateurs();
}

async function resetMdp(email) {
  if (!confirm('Envoyer un email de réinitialisation de mot de passe à ' + email + ' ?')) return;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  toast(error ? error.message : 'Email de réinitialisation envoyé à ' + email, !error);
}

// ---------- Modifier une personne de la liste d'aptitude (corriger une erreur de saisie) ----------
function ecranModifierAptitude(id) {
  const a = (window._apt || []).find(x => x.id === id);
  if (!a) return;
  $('staff-dashboard').innerHTML = `<div class="carte">
    <span class="lien-retour" onclick="ecranGestionFormateurs()">← Retour à la liste d'aptitude</span>
    <h2>Modifier — ${esc(a.prenom)} ${esc(a.nom)}</h2>
    <div class="ligne">
      <div><label>Matricule</label><input id="ma-mat" value="${esc(a.matricule || '')}"></div>
      <div><label>Grade</label><select id="ma-grade">${GRADES.map(g => `<option ${g === a.grade ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
    </div>
    <div class="ligne">
      <div><label>Nom</label><input id="ma-nom" value="${esc(a.nom)}"></div>
      <div><label>Prénom</label><input id="ma-prenom" value="${esc(a.prenom)}"></div>
    </div>
    <div class="ligne">
      <div><label>Statut</label><select id="ma-statut"><option value="">—</option>${STATUTS.map(s => `<option ${s === a.statut ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div><label>CIS de rattachement</label>${selectCIS('ma-cis', a.cis || '')}</div>
    </div>
    <label>Email (compte utilisateur)</label><input id="ma-email" type="email" value="${esc(a.email || '')}">
    <button class="btn" onclick="enregistrerModifAptitude(${a.id})">Enregistrer les corrections</button>
  </div>`;
}

async function enregistrerModifAptitude(id) {
  const nom = $('ma-nom').value.trim(), prenom = $('ma-prenom').value.trim();
  if (!nom || !prenom) return toast('Nom et prénom requis', false);
  const { error } = await sb.from('aptitudes').update({
    matricule: $('ma-mat').value.trim() || null, grade: $('ma-grade').value,
    nom, prenom, statut: $('ma-statut').value || null, cis: $('ma-cis').value || null,
    email: $('ma-email').value.trim().toLowerCase() || null,
  }).eq('id', id);
  if (error) return toast(error.message, false);
  toast('Informations corrigées'); ecranGestionFormateurs();
}

// ---------- Mon profil (accessible en cliquant sur son identité dans le bandeau) ----------
async function ecranMonProfil() {
  if (!S.user) return;
  const { data: { user } } = await sb.auth.getUser();
  const { data: apt } = await sb.from('aptitudes').select('*').ilike('email', user?.email || '').maybeSingle();

  $('staff-dashboard').innerHTML = `<div class="carte">
    <span class="lien-retour" onclick="ecranAccueilStaff()">← Retour</span>
    <h2>Mon profil</h2>
    <div class="info">Connecté avec : ${esc(user?.email || '')}</div>
    <label>Nom affiché dans l'appli</label>
    <input id="mp-nom" value="${esc(S.user.nom)}">
    <button class="btn secondaire" onclick="enregistrerMonNom()">Enregistrer le nom</button>

    <h3>Changer mon mot de passe</h3>
    <label>Nouveau mot de passe (6 caractères minimum)</label>
    <input id="mp-mdp" type="password">
    <button class="btn secondaire" onclick="changerMonMdp()">Mettre à jour le mot de passe</button>

    ${apt ? `
      <h3>Corriger mes informations (liste d'aptitude)</h3>
      <div class="info">Si une information te concernant est erronée, corrige-la ici directement.</div>
      <div class="ligne">
        <div><label>Matricule</label><input id="mp-mat" value="${esc(apt.matricule || '')}"></div>
        <div><label>Grade</label><select id="mp-grade">${GRADES.map(g => `<option ${g === apt.grade ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
      </div>
      <div class="ligne">
        <div><label>Statut</label><select id="mp-statut"><option value="">—</option>${STATUTS.map(s => `<option ${s === apt.statut ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div><label>CIS de rattachement</label>${selectCIS('mp-cis', apt.cis || '')}</div>
      </div>
      <button class="btn secondaire" onclick="enregistrerMesInfosAptitude(${apt.id})">Corriger mes informations</button>
    ` : `<p class="info">Aucune fiche dans la liste d'aptitude associée à cet email — contacte le GFor.</p>`}
  </div>`;
  show('ecran-staff-accueil');
}

async function enregistrerMonNom() {
  const nom = $('mp-nom').value.trim();
  if (!nom) return toast('Nom requis', false);
  const { error } = await sb.from('profils').update({ nom }).eq('id', S.user.id);
  if (error) return toast(error.message, false);
  S.user.nom = nom;
  $('bandeau-user').textContent = nom;
  toast('Nom mis à jour');
}

async function changerMonMdp() {
  const mdp = $('mp-mdp').value;
  if (mdp.length < 6) return toast('6 caractères minimum', false);
  const { error } = await sb.auth.updateUser({ password: mdp });
  toast(error ? error.message : 'Mot de passe mis à jour', !error);
  if (!error) $('mp-mdp').value = '';
}

async function enregistrerMesInfosAptitude(id) {
  const { error } = await sb.from('aptitudes').update({
    matricule: $('mp-mat').value.trim() || null, grade: $('mp-grade').value,
    statut: $('mp-statut').value || null, cis: $('mp-cis').value || null,
  }).eq('id', id);
  if (error) return toast(error.message, false);
  toast('Informations corrigées');
}

// ---------- Import Excel (une ligne par qualification) ----------
function versDateISO(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v || '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function importerAptitudes(input) {
  const fichier = input.files[0];
  if (!fichier) return;
  const lecteur = new FileReader();
  lecteur.onload = async e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const lignes = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const brutes = [];
      for (const l of lignes) {
        const o = {};
        for (const k of Object.keys(l)) {
          const c = norm(k);
          if (c.startsWith('matri')) o.matricule = String(l[k]).trim();
          else if (c.startsWith('nom')) o.nom = String(l[k]).trim();
          else if (c.startsWith('pren')) o.prenom = String(l[k]).trim();
          else if (c.startsWith('grade')) o.grade = String(l[k]).trim().toUpperCase();
          else if (c.startsWith('statut')) o.statut = STATUTS.includes(String(l[k]).trim().toUpperCase()) ? String(l[k]).trim().toUpperCase() : null;
          else if (c.startsWith('cis')) o.cis = String(l[k]).trim();
          else if (c.startsWith('email') || c.startsWith('mail')) o.email = String(l[k]).trim().toLowerCase();
          else if (c.startsWith('domaine')) o.domaine = DOMAINES_COMP.find(d => norm(l[k]).includes(d.toLowerCase())) || null;
          else if (c.startsWith('role') || c.startsWith('qualif')) o.role =
            (norm(l[k]).includes('for de for') || norm(l[k]).includes('fdf')) ? 'for_de_for'
            : (norm(l[k]).includes('rp') || norm(l[k]).includes('respon')) ? 'rp' : 'formateur';
          else if (c.includes('valid') || c.includes('fin')) o.fin_validite = versDateISO(l[k]);
        }
        if (o.nom && o.prenom) brutes.push(o);
      }
      if (!brutes.length) return toast('Aucune ligne exploitable — vérifier les colonnes (voir le modèle)', false);

      // Regroupement par personne (email, sinon matricule, sinon nom+prénom)
      const { data: existants } = await sb.from('aptitudes').select('*');
      const cle = o => (o.email || '') + '|' + (o.matricule || '') + '|' + norm(o.nom + o.prenom);
      const trouve = o => (existants || []).find(x =>
        (o.email && x.email === o.email) || (o.matricule && x.matricule === o.matricule) ||
        (norm(x.nom + x.prenom) === norm(o.nom + o.prenom)));
      const groupes = {};
      for (const o of brutes) (groupes[cle(o)] = groupes[cle(o)] || []).push(o);

      let nbP = 0, nbQ = 0;
      for (const g of Object.values(groupes)) {
        const o = g[0];
        let pers = trouve(o);
        if (!pers) {
          const ins = await sb.from('aptitudes').insert({
            matricule: o.matricule || null, nom: o.nom, prenom: o.prenom, grade: o.grade || null,
            statut: o.statut || null, cis: o.cis || null, email: o.email || null }).select().single();
          if (ins.error) return toast(ins.error.message, false);
          pers = ins.data; nbP++;
        }
        const qualis = g.filter(x => x.domaine && x.fin_validite)
          .map(x => ({ aptitude_id: pers.id, domaine: x.domaine, role: x.role || 'formateur', fin_validite: x.fin_validite }));
        if (qualis.length) {
          const { error: eq } = await sb.from('qualifications').upsert(qualis, { onConflict: 'aptitude_id,domaine,role' });
          if (eq) return toast(eq.message, false);
          nbQ += qualis.length;
        }
      }
      toast(nbP + ' personne(s) créée(s), ' + nbQ + ' qualification(s) importée(s)');
      ecranGestionFormateurs();
    } catch (err) { toast('Fichier illisible : ' + err.message, false); }
  };
  lecteur.readAsArrayBuffer(fichier);
}

function telechargerModeleAptitude() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Matricule', 'Nom', 'Prénom', 'Grade', 'Statut', 'CIS', 'Email', 'Domaine', 'Rôle', 'Fin de validité'],
    ['V0912345', 'GUEGAN', 'Pauline', 'ADC', 'SPV', 'CIS BANNALEC', 'p.guegan@sdis29.fr', 'INCENDIE', 'RP', '31/12/2027'],
    ['V0912345', 'GUEGAN', 'Pauline', 'ADC', 'SPV', 'CIS BANNALEC', 'p.guegan@sdis29.fr', 'PPBE', 'RP', '31/12/2027'],
    ['V0912345', 'GUEGAN', 'Pauline', 'ADC', 'SPV', 'CIS BANNALEC', 'p.guegan@sdis29.fr', 'SSUAP', 'Formateur', '30/06/2027'],
    ['V0954321', 'SINIC', 'Chloé', 'CCH', 'SPP', 'CIS QUIMPERLE', 'c.sinic@sdis29.fr', 'SSUAP', 'Formateur', '30/06/2027'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Aptitudes');
  XLSX.writeFile(wb, 'modele_liste_aptitude.xlsx');
}

async function ecranAccueilStaff() {
  majMenu('dash');
  show('ecran-staff-accueil');
  const [sess, stag, forms, formt] = await Promise.all([
    sb.from('sessions').select('*, formations(*)').order('date_debut', { ascending: true, nullsFirst: false }),
    sb.from('stagiaires').select('id, session_id'),
    sb.from('session_formateurs').select('id, session_id'),
    sb.from('formations').select('*').eq('actif', true),
  ]);
  if (sess.error) return toast(sess.error.message, false);
  const sessions = sess.data;
  for (const s of sessions) {
    s._nbStag = (stag.data || []).filter(x => x.session_id === s.id).length;
    s._nbForm = (forms.data || []).filter(x => x.session_id === s.id).length;
  }

  // Classement par dates réelles : en cours / en préparation (à venir) / terminées
  const auj = new Date().toISOString().slice(0, 10);
  const enCours = sessions.filter(s => s.date_debut && s.date_fin && s.date_debut <= auj && auj <= s.date_fin && s.statut !== 'terminee');
  const aVenir = sessions.filter(s => (!s.date_debut || s.date_debut > auj) && s.statut !== 'terminee');
  const passees = sessions.filter(s => !enCours.includes(s) && !aVenir.includes(s));

  // À venir : trié par thématique (domaine) puis par date
  aVenir.sort((a, b) => (a.formations.domaine + (a.date_debut || '9999')).localeCompare(b.formations.domaine + (b.date_debut || '9999')));
  const parDomaine = {};
  for (const s of aVenir) (parDomaine[s.formations.domaine] = parDomaine[s.formations.domaine] || []).push(s);

  $('staff-dashboard').innerHTML = `
    <div class="carte stat-row"><div class="chiffre">${enCours.length}</div><div>session(s) en cours</div></div>
    <div class="carte stat-row"><div class="chiffre">${aVenir.length}</div><div>session(s) en préparation</div></div>
    <div class="carte stat-row"><div class="chiffre">${passees.length}</div><div>session(s) terminée(s)</div></div>
    ${enCours.length ? '<div class="section-titre">🔴 En cours</div>' + enCours.map(carteSession).join('') : ''}
    ${Object.keys(parDomaine).map(d =>
      `<div class="section-titre">📅 En préparation — ${esc(d)}</div>` + parDomaine[d].map(carteSession).join('')).join('')}
    ${!enCours.length && !aVenir.length ? '<div class="carte"><p class="info">Aucune session en cours ou planifiée.</p></div>' : ''}
    ${passees.length ? '<div class="section-titre">✔ Terminées</div>' + passees.map(carteSession).join('') : ''}`;
}

// ---------- Vision stagiaire (pour l'encadrement) ----------
async function ecranChoixSessionVision() {
  majMenu();
  show('ecran-staff-accueil');
  const { data: sessions, error } = await sb.from('sessions').select('*, formations(libelle)').order('created_at', { ascending: false });
  if (error) return toast(error.message, false);
  $('staff-dashboard').innerHTML = `<div class="carte">
    <h2>Vision stagiaire — choisir la session</h2>
    ${sessions.length ? sessions.map(s => `<button class="btn-liste" onclick="visionStagiaireSession('${s.id}')">
      <b>${esc(s.formations.libelle)}</b> — ${esc(s.lieu || '')} (${esc(s.code_acces)})</button>`).join('')
      : '<p class="info">Aucune session disponible.</p>'}
  </div>`;
}

async function visionStagiaireSession(sessionId) {
  const { data: sess, error } = await sb.from('sessions').select('*').eq('id', sessionId).single();
  if (error) return toast(error.message, false);
  S.session = sess;
  await chargerFormation(sess.formation_id);
  const { data: stags } = await sb.from('stagiaires').select('*').eq('session_id', sessionId).order('nom');
  if (!stags || !stags.length) return toast('Aucun stagiaire dans cette session', false);
  window._stags = stags;
  $('staff-dashboard').innerHTML = `<div class="carte">
    <h2>Voir la formation comme quel stagiaire ?</h2>
    ${stags.map(st => `<button class="btn-liste" onclick="visionStagiaireNom(${st.id})">${esc(st.prenom)} ${esc(st.nom)}</button>`).join('')}
  </div>`;
}

function visionStagiaireNom(id) {
  S.stagiaire = window._stags.find(s => s.id === id);
  ecranAccueilStagiaire();
}

async function creerSession() {
  const sel = $('ns-formation');
  const fCode = sel.selectedOptions[0].dataset.code;
  const code = fCode + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const optR = $('ns-resp').selectedOptions[0];
  const responsable = optR && optR.value ? optR.dataset.nom : null;
  const dateFinS = $('ns-fin').value || null;
  if (optR && optR.value && dateFinS && optR.dataset.fin < dateFinS)
    return toast('Impossible : la qualification RP de ' + optR.dataset.nom + ' expire le ' + optR.dataset.fin + ', avant la fin de la session.', false);
  const { data, error } = await sb.from('sessions').insert({
    formation_id: Number(sel.value),
    code_acces: code,
    lieu: $('ns-lieu').value || null,
    date_debut: $('ns-debut').value || null,
    date_fin: $('ns-fin').value || null,
    responsable,
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
    ['evaluations', 'Évaluations'], ['msp', 'Suivi MSP'], ['validation', 'Validation'], ['comparatif', 'Comparatif'],
  ];
  $('session-onglets').innerHTML = onglets.map(([id, lbl]) =>
    `<button id="ong-${id}" onclick="ongletSession('${id}')">${lbl}</button>`).join('');
  show('ecran-session');
  ongletSession(S.vision === 'formateur' ? 'evaluations' : 'stagiaires');
}

function ongletSession(id) {
  document.querySelectorAll('#session-onglets button').forEach(b => b.classList.remove('actif'));
  $('ong-' + id).classList.add('actif');
  ({ stagiaires: ongletStagiaires, formateurs: ongletFormateurs, garde: ongletGarde,
     evaluations: ongletEvaluations, msp: ongletSuiviMSP, validation: ongletValidation, comparatif: ongletComparatif }[id])();
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
        <div><label>CIS de rattachement</label>${selectCIS('st-cis')}</div>
      </div>
      <button class="btn" onclick="ajouterStagiaire()">Ajouter</button>

      <h3>Import Excel</h3>
      <p class="info">Colonnes attendues : Nom, Prénom, Matricule, CIS.</p>
      <button class="btn secondaire" onclick="telechargerModeleStagiaires()">📄 Télécharger le modèle</button>
      <label style="margin-top:10px">Fichier à importer (.xlsx)</label>
      <input type="file" accept=".xlsx,.xls,.csv" onchange="importerStagiaires(this)">
    </div>`;
}

function telechargerModeleStagiaires() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Nom', 'Prénom', 'Matricule', 'CIS'],
    ['BERNARD', 'Esteban', 'V0911111', 'CIS BANNALEC'],
    ['JORAND', 'Romane', 'V0922222', 'CIS QUIMPERLE'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stagiaires');
  XLSX.writeFile(wb, 'modele_stagiaires.xlsx');
}

function importerStagiaires(input) {
  const fichier = input.files[0];
  if (!fichier) return;
  const lecteur = new FileReader();
  lecteur.onload = async e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const lignes = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const rows = [];
      for (const l of lignes) {
        const o = { session_id: S.session.id };
        for (const k of Object.keys(l)) {
          const c = norm(k);
          if (c.startsWith('nom')) o.nom = String(l[k]).trim();
          else if (c.startsWith('pren')) o.prenom = String(l[k]).trim();
          else if (c.startsWith('matri')) o.matricule = String(l[k]).trim();
          else if (c.startsWith('cis')) o.cis = String(l[k]).trim();
        }
        // pas de doublon : on ignore les stagiaires déjà présents dans la session
        if (o.nom && o.prenom && !S.data.stagiaires.some(s =>
          norm(s.nom + s.prenom) === norm(o.nom + o.prenom))) rows.push(o);
      }
      if (!rows.length) return toast('Aucune ligne exploitable ou stagiaires déjà tous présents', false);
      const { error } = await sb.from('stagiaires').insert(rows);
      if (error) return toast(error.message, false);
      toast(rows.length + ' stagiaire(s) importé(s)');
      await chargerDonneesSession(S.session.id); ongletStagiaires();
    } catch (err) { toast('Fichier illisible : ' + err.message, false); }
  };
  lecteur.readAsArrayBuffer(fichier);
}

async function ajouterStagiaire() {
  const nom = $('st-nom').value.trim(), prenom = $('st-prenom').value.trim();
  if (!nom || !prenom) return toast('Nom et prénom requis', false);
  const { error } = await sb.from('stagiaires').insert({
    session_id: S.session.id, nom, prenom,
    matricule: $('st-mat').value.trim() || null, cis: $('st-cis').value || null,
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

// ---------- Onglet Formateurs (inscription depuis la liste d'aptitude) ----------
async function ongletFormateurs() {
  const { data: apt } = await sb.from('aptitudes').select('*, qualifications(*)');
  const domComp = S.formation ? S.formation.domaine_competence : null;
  const dejaIds = S.data.formateurs.map(f => f.aptitude_id).filter(Boolean);
  const dejaNoms = S.data.formateurs.map(f => f.nom);
  const auj = new Date().toISOString().slice(0, 10);
  const dispo = (apt || [])
    .map(a => {
      // Une personne peut avoir plusieurs qualifications dans le même domaine (formateur/RP/for de for) :
      // on privilégie une qualification encore valide.
      const quals = (a.qualifications || []).filter(q => !domComp || q.domaine === domComp);
      const q = quals.find(q => q.fin_validite >= auj) || quals[0];
      return { a, q };
    })
    .filter(x => x.q && !dejaIds.includes(x.a.id) && !dejaNoms.includes(x.a.prenom + ' ' + x.a.nom));

  $('session-contenu').innerHTML = `
    <div class="carte">
      <h2>Équipe pédagogique (${S.data.formateurs.length})</h2>
      ${S.data.formateurs.map(f => `<div class="bloc-comp">${esc(f.nom)}
        <button class="btn petit secondaire" style="float:right" onclick="supprFormateur(${f.id})">✕</button></div>`).join('')}
      <h3>Inscrire un formateur (liste d'aptitude${domComp ? ' — domaine ' + esc(domComp) : ''})</h3>
      ${dispo.length ? `
        <select id="fo-apt">${dispo.map(x =>
          `<option value="${x.a.id}" data-fin="${x.q.fin_validite}" data-nom="${esc(x.a.prenom + ' ' + x.a.nom)}">
            ${esc(x.a.grade || '')} ${esc(x.a.prenom)} ${esc(x.a.nom)} (${esc(x.a.cis || '')}) — ${libelleRole(x.q.role)} ${esc(x.q.domaine)}, valide jusqu'au ${x.q.fin_validite}</option>`).join('')}</select>
        <button class="btn" onclick="ajouterFormateur()">Inscrire</button>`
      : `<p class="info">Personne de qualifié${domComp ? ' en ' + esc(domComp) : ''} et disponible dans la liste d'aptitude (menu « Formateurs », vision GFor).</p>`}
    </div>`;
}

async function ajouterFormateur() {
  const opt = $('fo-apt').selectedOptions[0];
  if (!opt) return;
  if (S.session.date_fin && opt.dataset.fin < S.session.date_fin)
    return toast('Impossible : la qualification de ' + opt.dataset.nom + ' expire le ' + opt.dataset.fin + ', avant la fin de la session (' + S.session.date_fin + ').', false);
  const { error } = await sb.from('session_formateurs').insert({
    session_id: S.session.id, nom: opt.dataset.nom, aptitude_id: Number(opt.value) });
  if (error) return toast(error.message, false);
  await chargerDonneesSession(S.session.id); ongletFormateurs(); toast('Formateur inscrit');
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
      <td>${esc(p.sujet || '')}</td><td>${p.evaluateur ? esc(p.evaluateur) : '<span class="statut-eca">À affecter</span>'}</td>
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
          <select id="pa-eval">
            <option value="">— À affecter (un formateur se positionnera) —</option>
            ${[...new Set([S.session.responsable, ...S.data.formateurs.map(f => f.nom)].filter(Boolean))]
              .map(n => `<option>${esc(n)}</option>`).join('')}
          </select></div>
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
  // Numéro unique : max en base + contrainte unique (session_id, numero), réessai si collision
  const { data: dernier } = await sb.from('passages').select('numero')
    .eq('session_id', S.session.id).order('numero', { ascending: false }).limit(1);
  let numero = ((dernier && dernier[0]) ? dernier[0].numero : 0) + 1;
  let passage = null, error = null;
  for (let essai = 0; essai < 3; essai++) {
    ({ data: passage, error } = await sb.from('passages').insert({
      session_id: S.session.id, numero,
      jour: $('pa-jour').value, theme_id: Number($('pa-theme').value),
      sujet: $('pa-sujet').value.trim() || null, evaluateur: $('pa-eval').value || null,
    }).select().single());
    if (!error) break;
    if (error.code === '23505') { numero++; continue; } // doublon : on prend le suivant
    break;
  }
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
      <div class="info">Évaluateur : ${p.evaluateur
        ? esc(p.evaluateur) + (S.user && p.evaluateur === S.user.nom ? ' (vous)' : '')
        : `<span class="statut-eca">à affecter</span> <button class="btn petit" onclick="prendrePassage(${p.id})">🙋 Je prends ce passage</button>`}</div>
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

async function prendrePassage(passageId) {
  const { data, error } = await sb.from('passages').update({ evaluateur: S.user.nom })
    .eq('id', passageId).is('evaluateur', null).select();
  if (error) return toast(error.message, false);
  if (!data.length) toast('Trop tard, un autre formateur s\'est positionné', false);
  else toast('Passage affecté à ' + S.user.nom);
  await chargerDonneesSession(S.session.id);
  ongletEvaluations();
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

// ---------- Onglet Suivi MSP (livrable 4 : suivi compétence groupe) ----------
// Page 1 (groupe) : consultable par tout l'encadrement (jamais par les stagiaires, cet onglet
// n'existe pas côté vision stagiaire). Page 2 (mots du formateur) : dupliquée côté stagiaire
// (voir ecranAccueilStagiaire) mais filtrée sur ses seuls passages.
function ongletSuiviMSP() {
  const stagiaires = S.data.stagiaires;

  const blocsGroupe = stagiaires.map(s => {
    const mesPassages = S.data.equipiers.filter(e => e.stagiaire_id === s.id)
      .map(e => S.data.passages.find(p => p.id === e.passage_id)).filter(Boolean).sort((a, b) => a.numero - b.numero);
    if (!mesPassages.length) return '';
    const lignesComp = S.formation.competences.map(c => {
      const cellules = mesPassages.map(p => {
        const ev = S.data.evaluations.find(x => x.passage_id === p.id && x.stagiaire_id === s.id);
        const n = ev ? ev.notes[c.id] : null;
        return `<td>${n && n !== 'NE' ? `<span class="niv niv-${NIV_CLASSE[n]}">${n}</span>` : '—'}</td>`;
      }).join('');
      return `<tr><td><span class="code">${esc(c.code)}</span></td>${cellules}</tr>`;
    }).join('');
    const dec = s.decision_jury === 'valide' ? '<span class="statut-valide">✅ Validé</span>'
      : (s.decision_jury === 'non_valide' ? '<span class="statut-na">❌ Non validé</span>' : '<span class="info">— à décider —</span>');
    return `<h3>${esc(s.prenom)} ${esc(s.nom)}</h3>
      <div class="table-scroll"><table>
        <tr><th>Compétence</th>${mesPassages.map(p => `<th>MSP n°${p.numero}</th>`).join('')}</tr>
        ${lignesComp}
      </table></div>
      <p class="info">Décision jury : ${dec}</p>`;
  }).join('');

  const blocsMots = stagiaires.map(s => {
    const mesPassages = S.data.equipiers.filter(e => e.stagiaire_id === s.id)
      .map(e => S.data.passages.find(p => p.id === e.passage_id)).filter(Boolean).sort((a, b) => a.numero - b.numero);
    const lignes = mesPassages.map(p => {
      const ev = S.data.evaluations.find(x => x.passage_id === p.id && x.stagiaire_id === s.id);
      return `<tr><td>MSP n°${p.numero}</td><td>${ev && ev.commentaire ? esc(ev.commentaire) : '—'}</td></tr>`;
    }).join('');
    if (!lignes) return '';
    return `<h3>${esc(s.prenom)} ${esc(s.nom)}</h3><table><tr><th>Passage</th><th>Mot du formateur</th></tr>${lignes}</table>`;
  }).join('');

  $('session-contenu').innerHTML = `
    <div class="carte">
      <h2>Suivi par mise en situation (MSP) — vue groupe</h2>
      <div class="info">Détail compétence par compétence et par passage, pour tous les stagiaires de la session. Réservé à l'encadrement.</div>
      ${blocsGroupe || '<p class="info">Aucun passage enregistré.</p>'}
    </div>
    <div class="carte">
      <h2>Mots du formateur par MSP</h2>
      <div class="info">Chaque stagiaire peut aussi consulter cette page, mais uniquement pour ses propres passages, depuis son espace personnel.</div>
      ${blocsMots || '<p class="info">Aucun commentaire enregistré.</p>'}
    </div>`;
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
    const dec = s.decision_jury || '';
    return `<tr><td><b>${esc(s.prenom)} ${esc(s.nom)}</b><br>
      <small class="${okMsp ? 'statut-valide' : 'statut-na'}">${nbPassages}/${S.formation.nb_msp_min} MSP évaluées</small><br>
      <button class="btn petit secondaire" style="margin-top:4px" onclick="genererFicheSuivi(${s.id})">📄 Fiche PDF</button></td>${cellules}
      <td><select onchange="enregistrerDecisionJury(${s.id}, this.value)" style="width:auto">
        <option value="" ${dec === '' ? 'selected' : ''}>— À décider —</option>
        <option value="valide" ${dec === 'valide' ? 'selected' : ''}>✅ Validé</option>
        <option value="non_valide" ${dec === 'non_valide' ? 'selected' : ''}>❌ Non validé</option>
      </select></td></tr>`;
  }).join('');

  $('session-contenu').innerHTML = `
    <div class="carte">
      <h2>Validation des compétences</h2>
      <div class="info">Règle RIOFE : compétence grisée = « acquise » (A ou A+) 2 fois minimum · ${S.formation.nb_msp_min} MSP évaluées minimum par stagiaire. Détail par case : nb Acquis / ECA / NA. La colonne « Décision jury » est la décision finale de la commission de certification.</div>
      <div class="table-scroll"><table>
        <tr><th>Stagiaire</th>${comps.map(c => `<th title="${esc(c.libelle)}">${esc(c.code)}</th>`).join('')}<th>Décision jury</th></tr>
        ${lignes}
      </table></div>
    </div>`;
}

async function enregistrerDecisionJury(stagiaireId, valeur) {
  const { error } = await sb.from('stagiaires').update({ decision_jury: valeur || null }).eq('id', stagiaireId);
  if (error) return toast(error.message, false);
  const s = S.data.stagiaires.find(x => x.id === stagiaireId);
  if (s) s.decision_jury = valeur || null;
  toast('Décision enregistrée');
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

// Comparatif façon grille RIOFE (p.25) : chaque compétence avec sa note formateur (A+/A/ECA/NA)
// et, juste en dessous, ses critères d'auto-évaluation rattachés (0 à 10), comme sur la fiche papier.
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

    const lignesComp = S.formation.competences.map(c => {
      const n = ev ? ev.notes[c.id] : null;
      const criteresComp = S.formation.criteres.filter(cr => cr.competence_id === c.id);
      const sousLignes = criteresComp.map(cr => {
        const v = auto ? auto.notes[cr.id] : null;
        if (!n && !v) return '';
        return `<tr><td style="padding-left:22px;color:#666">${esc(cr.libelle)}</td><td>${v ? '<b>' + v + '</b>/10' : '<span class="info">—</span>'}</td></tr>`;
      }).join('');
      if ((!n || n === 'NE') && !sousLignes) return '';
      return `<tr><td><span class="code">${esc(c.code)}</span> ${esc(c.libelle.slice(0, 70))}…</td>
        <td>${n && n !== 'NE' ? `<span class="niv niv-${NIV_CLASSE[n]}">${n}</span>` : '<span class="info">non évalué</span>'}</td></tr>${sousLignes}`;
    }).join('');

    return `<h3>Passage n°${p.numero} · ${esc(p.jour)} · ${esc(theme ? theme.libelle : '')}</h3>
      <div class="info">
        ${ev ? 'Formateur : ' + esc(ev.formateur || '') + ' · ressenti ' + (ev.ressenti_formateur ?? '—') + '/5' : 'Pas encore d’évaluation formateur'}
        ${auto && auto.ressenti ? ' · Ressenti stagiaire : ' + esc(auto.ressenti) : ''}
      </div>
      <table><tr><th>Compétence / critère</th><th>Note formateur / auto-éval</th></tr>
        ${lignesComp || '<tr><td colspan="2" class="info">Aucune donnée</td></tr>'}
      </table>
      ${ev && ev.commentaire ? `<p class="info">« ${esc(ev.commentaire)} »</p>` : ''}`;
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
    </div>
    <div class="carte">
      <h2>Mots de mes formateurs</h2>
      <p class="info">Le petit mot laissé par le formateur à l'issue de chacune de tes mises en situation.</p>
      <table><tr><th>Passage</th><th>Mot du formateur</th></tr>
        ${mesPassages.map(p => {
          const ev = S.data.evaluations.find(x => x.passage_id === p.id && x.stagiaire_id === stagiaireId);
          return `<tr><td>MSP n°${p.numero}</td><td>${ev && ev.commentaire ? esc(ev.commentaire) : '—'}</td></tr>`;
        }).join('') || '<tr><td colspan="2" class="info">Aucun passage pour le moment.</td></tr>'}
      </table>
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
