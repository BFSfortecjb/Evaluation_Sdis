// app.js — LE MÉTIER. Écrans, listes, formulaires. C'est ici qu'on travaille.
// Dépend de core.js (sb, S, show, $, esc, toast, chargerFormation).

const NIVEAUX = ['A+', 'A', 'ECA', 'NA', 'NE'];
const NIV_CLASSE = { 'A+': 'Aplus', 'A': 'A', 'ECA': 'ECA', 'NA': 'NA', 'NE': 'NE' };
// Nombre de jours réglable par formation (Paramètres formations) — J1..Jn
function joursFormation() {
  const n = (S.formation && S.formation.nb_jours) || 5;
  return Array.from({ length: n }, (_, i) => 'J' + (i + 1));
}

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
    `<button class="${actif === 'apt' ? 'actif' : ''}" onclick="ecranGestionFormateurs()">👨‍🏫 Formateurs</button>` +
    (S.vision === 'gfor' ? `<button class="${actif === 'param-form' ? 'actif' : ''}" onclick="ecranParametresFormations()">⚙️ Paramètres formations</button>` : '') +
    `<button class="${actif === 'parcours' ? 'actif' : ''}" onclick="ecranMonParcoursStagiaire()">📖 Mon parcours stagiaire</button>`;
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
function libelleRoleQualif(role) {
  return role === 'rp' ? 'RP' : role === 'for_de_for' ? 'For de For' : 'Form.';
}

function badgeQualif(q, suppr) {
  const auj = new Date().toISOString().slice(0, 10);
  const ok = q.fin_validite >= auj;
  return `<span class="badge" style="background:${couleurRole(q.role)};color:#fff;margin:2px">
    ${q.domaine} ${libelleRoleQualif(q.role)} <span style="opacity:.85">→ ${q.fin_validite}</span>${ok ? '' : ' ⚠'}
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
  window._formations = f.data || [];
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
      <td><b>${esc(a.nom)}</b> ${esc(a.prenom)}${a.gfor ? ' <span class="badge" style="background:#6a1b9a;color:#fff">GFOR</span>' : ''}${a.chef_centre ? ' <span class="badge" style="background:#00695c;color:#fff">CHEF CENTRE</span>' : ''}</td>
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
      <label>Mot de passe initial (optionnel)</label>
      <input id="ap-mdp" type="password" placeholder="6 caractères minimum — laisser vide pour passer par l'email">
      <div class="info">Si renseigné (avec un email), le compte est créé directement avec ce mot de passe — la personne pourra le changer ensuite dans « Mon profil ». Utile si les emails de confirmation n'arrivent pas (filtres antispam type Mailinblack).</div>
      <label><input type="checkbox" id="ap-gfor" style="width:auto"> Donner l'accès GFor (gestion complète : sessions, formateurs, liste d'aptitude...)</label>
      <label><input type="checkbox" id="ap-chef-centre" style="width:auto"> Donner l'accès Chef de centre (suivi des MSP des stagiaires de son CIS, réglé ci-dessus)</label>
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
      <p class="info">Une ligne par qualification (une même personne peut donc avoir plusieurs lignes). Colonnes : Matricule, Nom, Prénom, Grade, Statut, CIS, Email, Domaine, Rôle, Fin de validité, Mot de passe, GFor.
        Les deux dernières colonnes sont optionnelles : renseigne « Mot de passe » (6 caractères minimum, sur une seule ligne par personne suffit) pour créer directement son compte de connexion, et « GFor » = oui pour lui donner l'accès complet.</p>
      <button class="btn secondaire" onclick="telechargerModeleAptitude()">📄 Télécharger le modèle</button>
      <label style="margin-top:10px">Fichier à importer (.xlsx)</label>
      <input type="file" accept=".xlsx,.xls,.csv" onchange="importerAptitudes(this)">`
    : `<p class="info">Liste gérée par le Groupement Formation (vision GFor).</p>`}
  </div>`;
}

function _rendreQualisEnCours() {
  $('ap-q-liste').innerHTML = _qualisEnCours.map((q, i) =>
    `<span class="badge" style="background:${couleurRole(q.role)};color:#fff;margin:2px">
      ${q.domaine} ${libelleRoleQualif(q.role)} → ${q.fin_validite}
      <a onclick="_qualisEnCours.splice(${i},1);ajouterQualifEnCours._maj()" style="cursor:pointer;color:#fff"> ✕</a></span>`).join('');
}
function ajouterQualifEnCours() {
  const fin = $('ap-q-fin').value;
  if (!fin) return toast('Renseigner la fin de validité', false);
  const dom = $('ap-q-dom').value;
  const role = $('ap-q-role').value;
  // Une même personne peut cumuler plusieurs niveaux (formateur / RP / for de for) dans un même domaine ;
  // seul le doublon exact domaine+rôle est bloqué.
  if (_qualisEnCours.some(q => q.domaine === dom && q.role === role)) return toast('Ce niveau (' + libelleRoleQualif(role) + ') est déjà ajouté pour ce domaine', false);
  _qualisEnCours.push({ domaine: dom, role, fin_validite: fin });
  _rendreQualisEnCours();
}
ajouterQualifEnCours._maj = _rendreQualisEnCours;

async function ajouterAptitude() {
  const nom = $('ap-nom').value.trim(), prenom = $('ap-prenom').value.trim();
  if (!nom || !prenom) return toast('Nom et prénom requis', false);
  if (!_qualisEnCours.length) return toast('Ajouter au moins une qualification (domaine + rôle + validité)', false);
  const email = $('ap-email').value.trim().toLowerCase() || null;
  const mdp = $('ap-mdp').value;
  const gfor = $('ap-gfor').checked;
  const chefCentre = $('ap-chef-centre').checked;
  const { data: pers, error } = await sb.from('aptitudes').insert({
    matricule: $('ap-mat').value.trim() || null, grade: $('ap-grade').value,
    statut: $('ap-statut').value, nom, prenom,
    cis: $('ap-cis').value || null,
    email, gfor, chef_centre: chefCentre,
  }).select().single();
  if (error) return toast(error.message, false);
  const { error: e2 } = await sb.from('qualifications').insert(
    _qualisEnCours.map(q => ({ ...q, aptitude_id: pers.id })));
  if (e2) return toast(e2.message, false);

  // Création directe du compte avec mot de passe (utile quand les emails de confirmation
  // n'arrivent pas — filtre antispam, etc.). Ne fonctionne sans reconnexion manuelle que si
  // « Confirm email » est désactivé côté Supabase (Authentication > Providers > Email).
  if (email && mdp) {
    if (mdp.length < 6) {
      toast('Personne enregistrée, mais mot de passe ignoré (6 caractères minimum)', false);
    } else {
      const { data: inscription, error: e3 } = await sb.auth.signUp({ email, password: mdp });
      if (e3) {
        toast('Personne enregistrée, mais compte non créé : ' + e3.message, false);
      } else if (inscription.session) {
        // signUp a rendu actif le nouveau compte à la place du tien : on se déconnecte
        // immédiatement pour ne pas rester connecté à sa place.
        await sb.auth.signOut();
        toast('Compte créé avec mot de passe pour ' + prenom + ' ' + nom + ' — reconnecte-toi maintenant.');
        show('ecran-login');
        return;
      } else {
        toast('Personne enregistrée, compte créé — confirmation par email encore requise avant sa 1ère connexion.');
        ecranGestionFormateurs();
        return;
      }
    }
  }
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
    <label><input type="checkbox" id="ma-gfor" style="width:auto" ${a.gfor ? 'checked' : ''}> Donner l'accès GFor (gestion complète : sessions, formateurs, liste d'aptitude...)</label>
    <label><input type="checkbox" id="ma-chef-centre" style="width:auto" ${a.chef_centre ? 'checked' : ''}> Donner l'accès Chef de centre (suivi des MSP des stagiaires de son CIS, réglé ci-dessus)</label>
    <button class="btn" onclick="enregistrerModifAptitude(${a.id})">Enregistrer les corrections</button>

    <h3>Compte de connexion</h3>
    <div class="info">Si cette personne n'a jamais fini de créer son compte (cas fréquent : elle est dans la liste d'aptitude mais aucun compte de connexion n'existe encore), tu peux lui en créer un directement avec un mot de passe de ton choix — sans passer par un email.</div>
    <label>Mot de passe à créer</label>
    <input id="ma-mdp" type="password" placeholder="6 caractères minimum">
    <button class="btn secondaire" onclick="creerCompteAptitudeExistante(${a.id})">Créer le compte avec ce mot de passe</button>
  </div>`;
}

async function creerCompteAptitudeExistante(id) {
  const a = (window._apt || []).find(x => x.id === id);
  const email = $('ma-email').value.trim().toLowerCase();
  const mdp = $('ma-mdp').value;
  if (!email) return toast('Renseigner un email avant de créer le compte', false);
  if (mdp.length < 6) return toast('Mot de passe : 6 caractères minimum', false);
  const { data: inscription, error } = await sb.auth.signUp({ email, password: mdp });
  if (error) return toast(error.message, false);
  if (inscription.session) {
    // signUp a rendu actif le nouveau compte à la place du tien : on se déconnecte
    // immédiatement pour ne pas rester connecté à sa place.
    await sb.auth.signOut();
    toast('Compte créé pour ' + (a ? a.prenom + ' ' + a.nom : email) + ' — reconnecte-toi maintenant.');
    show('ecran-login');
  } else {
    toast('Compte créé — confirmation par email encore requise avant sa 1ère connexion.');
    ecranGestionFormateurs();
  }
}

async function enregistrerModifAptitude(id) {
  const nom = $('ma-nom').value.trim(), prenom = $('ma-prenom').value.trim();
  if (!nom || !prenom) return toast('Nom et prénom requis', false);
  const email = $('ma-email').value.trim().toLowerCase() || null;
  const gfor = $('ma-gfor').checked;
  const chefCentre = $('ma-chef-centre').checked;
  const { data: apt, error } = await sb.from('aptitudes').update({
    matricule: $('ma-mat').value.trim() || null, grade: $('ma-grade').value,
    nom, prenom, statut: $('ma-statut').value || null, cis: $('ma-cis').value || null,
    email, gfor, chef_centre: chefCentre,
  }).eq('id', id).select('*, qualifications(*)').single();
  if (error) return toast(error.message, false);
  if (apt) await synchroniserRoleProfil(apt);
  toast('Informations corrigées'); ecranGestionFormateurs();
}

// Garde le rôle du profil (droits d'accès) synchronisé avec la liste d'aptitude,
// pour le cas où le compte de connexion existait déjà avant une modification
// (ex : on coche l'accès GFor sur une personne qui a déjà un compte).
async function synchroniserRoleProfil(aptitude) {
  if (!aptitude.email) return;
  const quals = aptitude.qualifications || [];
  const estRP = quals.some(q => q.role === 'rp');
  // Sans aucune qualification (ni formateur, ni RP), la personne est considérée comme
  // un simple stagiaire (ex : recrue) plutôt que formateur par défaut.
  const nouveauRole = aptitude.gfor ? 'gfor'
    : aptitude.chef_centre ? 'chef_centre'
    : estRP ? 'rp'
    : quals.length ? 'formateur' : 'stagiaire';
  const { error } = await sb.from('profils').update({ role: nouveauRole }).eq('email', aptitude.email);
  if (error) console.warn('Synchronisation profil impossible :', error.message);
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
          else if (c.startsWith('mdp') || c.includes('motdepasse') || c.startsWith('password'))
            o.mdp = String(l[k] ?? '').trim();
          else if (c.startsWith('gfor')) o.gfor = /^(oui|yes|true|1|x)$/i.test(String(l[k] ?? '').trim());
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

      // Compte GFor courant, pour pouvoir restaurer sa session entre deux créations de compte
      // (sb.auth.signUp() active automatiquement la session du compte qu'il vient de créer).
      const { data: { session: sessionGFor } } = await sb.auth.getSession();

      let nbP = 0, nbQ = 0, nbComptes = 0, nbComptesEchec = 0;
      for (const g of Object.values(groupes)) {
        const o = g[0];
        let pers = trouve(o);
        if (!pers) {
          const ins = await sb.from('aptitudes').insert({
            matricule: o.matricule || null, nom: o.nom, prenom: o.prenom, grade: o.grade || null,
            statut: o.statut || null, cis: o.cis || null, email: o.email || null, gfor: o.gfor || false }).select().single();
          if (ins.error) return toast(ins.error.message, false);
          pers = ins.data; nbP++;
        } else if (o.email && !pers.email) {
          // Complète l'email s'il manquait — nécessaire pour pouvoir créer le compte juste après.
          const upd = await sb.from('aptitudes').update({ email: o.email }).eq('id', pers.id).select().single();
          if (!upd.error) pers = upd.data;
        }
        const qualis = g.filter(x => x.domaine && x.fin_validite)
          .map(x => ({ aptitude_id: pers.id, domaine: x.domaine, role: x.role || 'formateur', fin_validite: x.fin_validite }));
        if (qualis.length) {
          const { error: eq } = await sb.from('qualifications').upsert(qualis, { onConflict: 'aptitude_id,domaine,role' });
          if (eq) return toast(eq.message, false);
          nbQ += qualis.length;
        }

        // Création du compte de connexion si un mot de passe est renseigné dans le fichier
        if (o.mdp && pers.email) {
          if (o.mdp.length < 6) {
            nbComptesEchec++;
          } else {
            const { error: eSignup } = await sb.auth.signUp({ email: pers.email, password: o.mdp });
            if (eSignup) {
              nbComptesEchec++;
            } else {
              nbComptes++;
              // Restaure immédiatement la session du GFor avant de traiter la personne suivante.
              if (sessionGFor) await sb.auth.setSession({ access_token: sessionGFor.access_token, refresh_token: sessionGFor.refresh_token });
            }
          }
        }
      }
      let msg = nbP + ' personne(s) créée(s), ' + nbQ + ' qualification(s) importée(s)';
      if (nbComptes) msg += ', ' + nbComptes + ' compte(s) de connexion créé(s)';
      if (nbComptesEchec) msg += ' (' + nbComptesEchec + ' compte(s) non créé(s) — email déjà utilisé ou mot de passe trop court)';
      toast(msg);
      ecranGestionFormateurs();
    } catch (err) { toast('Fichier illisible : ' + err.message, false); }
  };
  lecteur.readAsArrayBuffer(fichier);
}

function telechargerModeleAptitude() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['Matricule', 'Nom', 'Prénom', 'Grade', 'Statut', 'CIS', 'Email', 'Domaine', 'Rôle', 'Fin de validité', 'Mot de passe', 'GFor'],
    ['V0912345', 'GUEGAN', 'Pauline', 'ADC', 'SPV', 'CIS BANNALEC', 'p.guegan@sdis29.fr', 'INCENDIE', 'RP', '31/12/2027', 'motdepasse1', 'non'],
    ['V0912345', 'GUEGAN', 'Pauline', 'ADC', 'SPV', 'CIS BANNALEC', 'p.guegan@sdis29.fr', 'PPBE', 'RP', '31/12/2027', '', ''],
    ['V0912345', 'GUEGAN', 'Pauline', 'ADC', 'SPV', 'CIS BANNALEC', 'p.guegan@sdis29.fr', 'SSUAP', 'Formateur', '30/06/2027', '', ''],
    ['V0954321', 'SINIC', 'Chloé', 'CCH', 'SPP', 'CIS QUIMPERLE', 'c.sinic@sdis29.fr', 'SSUAP', 'Formateur', '30/06/2027', 'autremdp2', 'non'],
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
    sb.from('stagiaires').select('id, session_id, cis'),
    sb.from('session_formateurs').select('id, session_id, nom'),
    sb.from('formations').select('*').eq('actif', true),
  ]);
  if (sess.error) return toast(sess.error.message, false);
  let sessions = sess.data;
  for (const s of sessions) {
    s._nbStag = (stag.data || []).filter(x => x.session_id === s.id).length;
    s._nbForm = (forms.data || []).filter(x => x.session_id === s.id).length;
  }

  // Vision RP / Formateur : ne montrer que ses propres sessions actives ou en préparation
  // (déclaré RP, ou inscrit comme formateur) — les sessions terminées restent visibles de tous.
  // « Vue globale » (GFor uniquement) permet de désactiver ce filtre pour voir/tester comme si
  // on était omniscient, sans avoir besoin d'un second compte.
  sessions = sessions.filter(s => {
    if (s.statut === 'terminee') return true;
    if (S.omniscient) return true;
    if (S.vision === 'rp') return !!(S.user && s.responsable === S.user.nom);
    if (S.vision === 'formateur') return !!(S.user && (forms.data || []).some(f => f.session_id === s.id && f.nom === S.user.nom));
    // Chef de centre : uniquement les sessions où au moins un stagiaire de son CIS est inscrit.
    if (S.vision === 'chef_centre') return !!(S.user && (stag.data || []).some(x => x.session_id === s.id && x.cis === S.user.cis));
    return true;
  });

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
  // Seuils NA/ECA « avis du jury » repris des valeurs par défaut de la formation
  // (réglables ensuite finement session par session dans l'onglet Paramètres).
  const formationChoisie = (window._formations || []).find(x => x.id === Number(sel.value));
  const { data, error } = await sb.from('sessions').insert({
    formation_id: Number(sel.value),
    code_acces: code,
    lieu: $('ns-lieu').value || null,
    date_debut: $('ns-debut').value || null,
    date_fin: $('ns-fin').value || null,
    responsable,
    seuil_na_jury: (formationChoisie && formationChoisie.seuil_na_jury_defaut) || 2,
    seuil_eca_jury: (formationChoisie && formationChoisie.seuil_eca_jury_defaut) || 4,
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

  // Chef de centre : accès restreint au seul suivi MSP (filtré sur les stagiaires de son CIS),
  // pas de gestion des stagiaires/formateurs/évaluations des autres centres.
  const onglets = S.vision === 'chef_centre'
    ? [['msp', 'Suivi MSP']]
    : [
        ['stagiaires', 'Stagiaires'], ['formateurs', 'Formateurs'], ['garde', 'Feuille de garde'],
        ['evaluations', 'Évaluations'], ['msp', 'Suivi MSP'], ['validation', 'Validation'], ['comparatif', 'Comparatif'],
      ];
  // Réglages du stage : réservés au RP et au GFor
  if (S.vision === 'rp' || S.vision === 'gfor') onglets.push(['parametres', 'Paramètres']);
  $('session-onglets').innerHTML = onglets.map(([id, lbl]) =>
    `<button id="ong-${id}" onclick="ongletSession('${id}')">${lbl}</button>`).join('');
  show('ecran-session');
  ongletSession(S.vision === 'chef_centre' ? 'msp' : S.vision === 'formateur' ? 'evaluations' : 'stagiaires');
}

function ongletSession(id) {
  document.querySelectorAll('#session-onglets button').forEach(b => b.classList.remove('actif'));
  $('ong-' + id).classList.add('actif');
  ({ stagiaires: ongletStagiaires, formateurs: ongletFormateurs, garde: ongletGarde,
     evaluations: ongletEvaluations, msp: ongletSuiviMSP, validation: ongletValidation, comparatif: ongletComparatif,
     parametres: ongletParametresStage }[id])();
}

// ---------- Onglet Stagiaires ----------
function ongletStagiaires() {
  const lignes = S.data.stagiaires.map(s => `
    <tr>
      <td>${s.photo_url ? `<img src="${esc(s.photo_url)}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;vertical-align:middle">` : `<span class="avatar-stag" style="width:32px;height:32px;font-size:11px">${esc(initiales(s))}</span>`}</td>
      <td>${esc(s.nom)}</td><td>${esc(s.prenom)}</td><td>${esc(s.matricule || '')}</td><td>${esc(s.cis || '')}</td>
      <td>${s.aptitude_id ? '<span class="statut-valide">✓ compte</span>' : '<span class="info">—</span>'}</td>
      <td style="white-space:nowrap">
        <label class="btn petit secondaire" style="cursor:pointer">📷<input type="file" accept="image/*" style="display:none" onchange="uploaderPhotoStagiaire(${s.id}, this)"></label>
        <button class="btn petit secondaire" title="Compte personnel" onclick="ecranCompteStagiaire(${s.id})">🔑</button>
        ${s.aptitude_id ? `<button class="btn petit secondaire" title="Historique multi-stages" onclick="voirHistoriqueStagiaire(${s.aptitude_id})">🕘</button>` : ''}
        <button class="btn petit secondaire" onclick="supprStagiaire(${s.id})">✕</button>
      </td>
    </tr>`).join('');
  $('session-contenu').innerHTML = `
    <div class="carte">
      <h2>Stagiaires (${S.data.stagiaires.length})</h2>
      <div class="info">📷 = photo (grille d'évaluation par équipe) · 🔑 = créer/lier le compte personnel du stagiaire (suivi de son parcours sur plusieurs stages) · 🕘 = voir son historique d'autres stages, une fois le compte lié.</div>
      <div class="table-scroll"><table>
        <tr><th>Photo</th><th>Nom</th><th>Prénom</th><th>Matricule</th><th>CIS</th><th>Compte</th><th></th></tr>${lignes}
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
      const { data: aptitudes } = await sb.from('aptitudes').select('*');
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
          norm(s.nom + s.prenom) === norm(o.nom + o.prenom))) {
          // Rattachement automatique à une fiche d'identité déjà connue (autre stage suivi, ou
          // formateur) — récupère aussi sa photo commune sans action supplémentaire.
          const apt = (aptitudes || []).find(a => o.matricule && a.matricule === o.matricule) ||
            (aptitudes || []).find(a => norm(a.nom + a.prenom) === norm(o.nom + o.prenom));
          if (apt) { o.aptitude_id = apt.id; if (apt.photo_url) o.photo_url = apt.photo_url; }
          rows.push(o);
        }
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
  const matricule = $('st-mat').value.trim() || null;
  const { data: nouveau, error } = await sb.from('stagiaires').insert({
    session_id: S.session.id, nom, prenom,
    matricule, cis: $('st-cis').value || null,
  }).select().single();
  if (error) return toast(error.message, false);
  // Si cette personne a déjà une fiche d'identité (autre stage suivi, ou formateur), on la
  // rattache automatiquement et on récupère sa photo commune sans action supplémentaire.
  const apt = await _trouverAptitudeCorrespondante(nom, prenom, matricule);
  if (apt) await sb.from('stagiaires').update({ aptitude_id: apt.id, photo_url: apt.photo_url || null }).eq('id', nouveau.id);
  await chargerDonneesSession(S.session.id); ongletStagiaires(); toast('Stagiaire ajouté');
}

async function supprStagiaire(id) {
  if (!confirm('Supprimer ce stagiaire et toutes ses évaluations ?')) return;
  const { error } = await sb.from('stagiaires').delete().eq('id', id);
  if (error) return toast(error.message, false);
  await chargerDonneesSession(S.session.id); ongletStagiaires();
}

// ---------- Rapprochement avec l'identité stable (aptitudes) ----------
// Une même personne physique a une ligne « stagiaire » par session mais une seule fiche
// d'identité stable dans aptitudes. On la retrouve par matricule (fiable) ou à défaut par
// nom+prénom, pour partager entre stages tout ce qui est propre à la personne (photo, historique).
async function _trouverAptitudeCorrespondante(nom, prenom, matricule) {
  const { data: candidats } = await sb.from('aptitudes').select('*');
  if (!candidats) return null;
  return candidats.find(a => matricule && a.matricule === matricule) ||
    candidats.find(a => (a.nom + a.prenom).toLowerCase() === (nom + prenom).toLowerCase()) || null;
}

// Retourne l'aptitude déjà liée à ce stagiaire, ou la retrouve/la crée (même logique de
// rapprochement que creerCompteStagiaire) — utilisé pour rattacher une photo sans forcément
// passer par la création d'un compte de connexion.
async function _resoudreOuCreerAptitude(s) {
  if (s.aptitude_id) {
    const { data } = await sb.from('aptitudes').select('*').eq('id', s.aptitude_id).maybeSingle();
    if (data) return data;
  }
  const existant = await _trouverAptitudeCorrespondante(s.nom, s.prenom, s.matricule);
  if (existant) {
    if (!s.aptitude_id) await sb.from('stagiaires').update({ aptitude_id: existant.id }).eq('id', s.id);
    return existant;
  }
  const { data: nouveau, error } = await sb.from('aptitudes').insert({
    matricule: s.matricule || null, nom: s.nom, prenom: s.prenom, cis: s.cis || null,
  }).select().single();
  if (error) throw error;
  await sb.from('stagiaires').update({ aptitude_id: nouveau.id }).eq('id', s.id);
  return nouveau;
}

// ---------- Photo du stagiaire (bucket Supabase Storage « photos-stagiaires ») ----------
// La photo est désormais rattachée à l'identité stable (aptitudes), commune à tous les stages
// de la personne : un formateur qui met à jour la photo la met à jour partout, sans avoir à la
// re-déposer à chaque nouveau stage.
async function uploaderPhotoStagiaire(id, input) {
  const fichier = input.files[0];
  if (!fichier) return;
  if (fichier.size > 3 * 1024 * 1024) return toast('Photo trop lourde (3 Mo maximum)', false);
  const s = S.data.stagiaires.find(x => x.id === id);
  if (!s) return;
  let apt;
  try { apt = await _resoudreOuCreerAptitude(s); }
  catch (err) { return toast('Rattachement identité impossible : ' + err.message, false); }

  const ext = (fichier.name.split('.').pop() || 'jpg').toLowerCase();
  const chemin = 'apt-' + apt.id + '/' + Date.now() + '.' + ext;
  const { error: eUp } = await sb.storage.from('photos-stagiaires').upload(chemin, fichier, { upsert: true });
  if (eUp) return toast('Envoi impossible : ' + eUp.message, false);
  const { data: pub } = sb.storage.from('photos-stagiaires').getPublicUrl(chemin);

  const { error: eApt } = await sb.from('aptitudes').update({ photo_url: pub.publicUrl }).eq('id', apt.id);
  if (eApt) return toast(eApt.message, false);
  // Photo commune : répercutée sur tous les stages déjà enregistrés de cette personne, pas
  // seulement la session en cours.
  const { error: eMaj } = await sb.from('stagiaires').update({ photo_url: pub.publicUrl }).eq('aptitude_id', apt.id);
  if (eMaj) return toast(eMaj.message, false);
  await chargerDonneesSession(S.session.id); ongletStagiaires();
  toast('Photo enregistrée — commune à tous les stages de ' + s.prenom + ' ' + s.nom);
}

// ---------- Compte personnel du stagiaire ----------
// Un stagiaire est aussi, potentiellement, une personne de la liste d'aptitude (un formateur CCH
// peut par exemple devenir stagiaire sur une session CA1E1E) : on réutilise la même table
// « aptitudes » comme identité stable de la personne, quel que soit son rôle du moment.
// stagiaires.aptitude_id relie la ligne « stagiaire » (propre à une session) à cette identité,
// ce qui permet de retrouver tout son parcours (formateur ou stagiaire) au même endroit.
async function ecranCompteStagiaire(id) {
  const s = S.data.stagiaires.find(x => x.id === id);
  if (!s) return;
  let apt = null;
  if (s.aptitude_id) {
    const { data } = await sb.from('aptitudes').select('*').eq('id', s.aptitude_id).maybeSingle();
    apt = data;
  } else {
    // Suggestion de rapprochement : une personne existante dans la liste d'aptitude
    // (même matricule, ou même nom + prénom) est peut-être déjà cette personne.
    const { data: candidats } = await sb.from('aptitudes').select('*');
    apt = (candidats || []).find(a =>
      (s.matricule && a.matricule === s.matricule)) ||
      (candidats || []).find(a => (a.nom + a.prenom).toLowerCase() === (s.nom + s.prenom).toLowerCase()) || null;
  }
  $('session-contenu').innerHTML = `<div class="carte">
    <span class="lien-retour" onclick="ongletStagiaires()">← Retour aux stagiaires</span>
    <h2>Compte personnel — ${esc(s.prenom)} ${esc(s.nom)}</h2>
    ${s.aptitude_id
      ? `<div class="info">Déjà relié à la liste d'aptitude (identité stable) — email : ${esc(apt?.email || 'non renseigné')}.</div>`
      : apt
        ? `<div class="info">Une fiche correspondante existe déjà dans la liste d'aptitude (${esc(apt.prenom)} ${esc(apt.nom)}${apt.matricule ? ', matricule ' + esc(apt.matricule) : ''}) — elle sera reliée à ce stagiaire pour permettre le suivi de son parcours.</div>`
        : `<div class="info">Aucune fiche correspondante trouvée — une nouvelle fiche d'identité sera créée pour cette personne.</div>`}
    <label>Email (compte de connexion)</label>
    <input id="cs-email" type="email" value="${esc(apt?.email || '')}">
    <label>Mot de passe à créer (laisser vide pour ne relier que l'identité, sans créer le compte maintenant)</label>
    <input id="cs-mdp" type="password" placeholder="6 caractères minimum">
    <button class="btn" onclick="creerCompteStagiaire(${id})">Enregistrer</button>
  </div>`;
}

async function creerCompteStagiaire(id) {
  const s = S.data.stagiaires.find(x => x.id === id);
  if (!s) return;
  const email = $('cs-email').value.trim().toLowerCase();
  const mdp = $('cs-mdp').value;

  let aptitudeId = s.aptitude_id;
  if (!aptitudeId) {
    // Rapprochement identique à ecranCompteStagiaire, refait ici pour ne pas dépendre de l'état d'écran.
    const { data: candidats } = await sb.from('aptitudes').select('*');
    const existant = (candidats || []).find(a => (s.matricule && a.matricule === s.matricule)) ||
      (candidats || []).find(a => (a.nom + a.prenom).toLowerCase() === (s.nom + s.prenom).toLowerCase());
    if (existant) {
      aptitudeId = existant.id;
      if (email && !existant.email) await sb.from('aptitudes').update({ email }).eq('id', existant.id);
    } else {
      const { data: nouveau, error: eIns } = await sb.from('aptitudes').insert({
        matricule: s.matricule || null, nom: s.nom, prenom: s.prenom, cis: s.cis || null, email: email || null,
      }).select().single();
      if (eIns) return toast(eIns.message, false);
      aptitudeId = nouveau.id;
    }
    const { error: eLien } = await sb.from('stagiaires').update({ aptitude_id: aptitudeId }).eq('id', id);
    if (eLien) return toast(eLien.message, false);
    // Photo commune : si l'identité retrouvée a déjà une photo (déposée lors d'un autre stage)
    // et que ce stagiaire n'en a pas encore, on la récupère automatiquement.
    if (existant && existant.photo_url && !s.photo_url) {
      await sb.from('stagiaires').update({ photo_url: existant.photo_url }).eq('id', id);
    }
  } else if (email) {
    await sb.from('aptitudes').update({ email }).eq('id', aptitudeId);
  }

  if (mdp) {
    if (mdp.length < 6) {
      toast('Identité enregistrée, mais mot de passe ignoré (6 caractères minimum)', false);
    } else if (!email) {
      toast('Identité enregistrée, mais compte non créé : renseigner un email', false);
    } else {
      const { data: { session: sessionActuelle } } = await sb.auth.getSession();
      const { data: inscription, error: eSignup } = await sb.auth.signUp({ email, password: mdp });
      if (eSignup) {
        toast('Identité enregistrée, mais compte non créé : ' + eSignup.message, false);
      } else if (inscription.session) {
        // signUp a activé la session du nouveau compte à la place de la tienne : on se déconnecte
        // immédiatement pour ne pas rester connecté à sa place.
        await sb.auth.signOut();
        toast('Compte créé pour ' + s.prenom + ' ' + s.nom + ' — reconnecte-toi maintenant.');
        show('ecran-login');
        return;
      } else {
        toast('Identité enregistrée, compte créé — confirmation par email encore requise avant sa 1ère connexion.');
      }
      if (sessionActuelle) await sb.auth.setSession({ access_token: sessionActuelle.access_token, refresh_token: sessionActuelle.refresh_token });
    }
  } else {
    toast('Identité enregistrée');
  }
  await chargerDonneesSession(S.session.id); ongletStagiaires();
}

// Historique multi-stages d'une personne (formateur devenu stagiaire, ou stagiaire ayant
// déjà suivi d'autres stages) : consultable par RP/GFor depuis l'onglet Stagiaires.
async function voirHistoriqueStagiaire(aptitudeId) {
  const { data: passages, error } = await sb.from('stagiaires')
    .select('*, sessions(*, formations(libelle, couleur))').eq('aptitude_id', aptitudeId);
  if (error) return toast(error.message, false);
  const lignes = (passages || [])
    .sort((a, b) => (b.sessions?.date_debut || '').localeCompare(a.sessions?.date_debut || ''))
    .map(p => `<div class="carte carte-session" style="border-left-color:${esc(p.sessions?.formations?.couleur || '#607d8b')}" onclick="ouvrirSession('${p.sessions?.id}')">
        <b>${esc(p.sessions?.formations?.libelle || '?')}</b> — ${esc(p.sessions?.lieu || '')}
        <div class="info">${esc(p.sessions?.date_debut || '?')} → ${esc(p.sessions?.date_fin || '?')}
          ${p.decision_jury ? ' · Décision : ' + (p.decision_jury === 'valide' ? '✅ Validé' : '❌ Non validé') : ''}</div>
        <button class="btn petit secondaire" style="margin-top:6px" onclick="event.stopPropagation(); genererLivretHistorique('${p.sessions?.id}', ${p.id}, this)">📘 Consulter le livret de ce stage</button>
      </div>`).join('');
  $('session-contenu').innerHTML = `<div class="carte">
    <span class="lien-retour" onclick="ongletStagiaires()">← Retour aux stagiaires</span>
    <h2>Historique des stages</h2>
    <div class="info">Tous les stages suivis par cette personne, tous rôles confondus (formateur pouvant devenir stagiaire, etc.). Cliquer sur un stage l'ouvre, ou télécharger directement son livret de certification pour voir comment il/elle s'en est sorti (difficultés, décision du jury…).</div>
    ${lignes || '<p class="info">Aucun autre stage enregistré.</p>'}
  </div>`;
}

// Génère le livret de certification d'un stage passé directement depuis l'historique multi-stages,
// sans avoir à naviguer manuellement dans cette session (utile pour un formateur qui veut savoir
// rapidement comment s'est passé un stage précédent — difficultés rencontrées, décision du jury…).
// Recharge temporairement session/formation/données dans l'état global S, comme le ferait
// ouvrirSession(), car genererLivretCertification() en dépend.
async function genererLivretHistorique(sessionId, stagiaireId, bouton) {
  if (!sessionId) return toast('Session introuvable', false);
  if (bouton) { bouton.disabled = true; bouton.textContent = 'Génération…'; }
  try {
    const { data: sess, error } = await sb.from('sessions').select('*, formations(libelle)').eq('id', sessionId).single();
    if (error) throw error;
    S.session = sess;
    await chargerFormation(sess.formation_id);
    await chargerDonneesSession(sessionId);
    await genererLivretCertification(stagiaireId);
  } catch (err) {
    toast('Livret impossible : ' + err.message, false);
  } finally {
    if (bouton) { bouton.disabled = false; bouton.textContent = '📘 Consulter le livret de ce stage'; }
  }
}

// ---------- Mon parcours (stagiaire) — accessible à toute personne de la liste d'aptitude,
// que ce soit son espace principal (compte « stagiaire » pur) ou un complément à son espace
// formateur/RP/GFor habituel (ex : formateur CCH devenu stagiaire sur une session CA1E1E).
async function ecranMonParcoursStagiaire() {
  majMenu('parcours');
  show('ecran-staff-accueil');
  const { data: { user } } = await sb.auth.getUser();
  const { data: apt } = await sb.from('aptitudes').select('*').ilike('email', user?.email || '').maybeSingle();
  if (!apt) {
    $('staff-dashboard').innerHTML = `<div class="carte"><p class="info">Aucune fiche d'identité trouvée pour ton compte — contacte le GFor.</p></div>`;
    return;
  }
  const { data: passages, error } = await sb.from('stagiaires')
    .select('*, sessions(*, formations(libelle, couleur))').eq('aptitude_id', apt.id);
  if (error) return toast(error.message, false);
  const lignes = (passages || [])
    .sort((a, b) => (b.sessions?.date_debut || '').localeCompare(a.sessions?.date_debut || ''))
    .map(p => `<div class="carte carte-session" style="border-left-color:${esc(p.sessions?.formations?.couleur || '#607d8b')}" onclick="ouvrirMonStage(${p.id}, '${p.sessions?.id}')">
        <b>${esc(p.sessions?.formations?.libelle || '?')}</b> — ${esc(p.sessions?.lieu || '')}
        <div class="info">${esc(p.sessions?.date_debut || '?')} → ${esc(p.sessions?.date_fin || '?')}
          ${p.decision_jury ? ' · Décision : ' + (p.decision_jury === 'valide' ? '✅ Validé' : '❌ Non validé') : ''}</div>
      </div>`).join('');
  $('staff-dashboard').innerHTML = `<div class="carte">
    <h2>Mon parcours de stagiaire</h2>
    <div class="info">Tous les stages où tu as été inscrit(e) comme stagiaire, quelle que soit ta fonction habituelle par ailleurs.</div>
  </div>
  ${lignes || '<div class="carte"><p class="info">Aucun stage enregistré à ton nom pour le moment.</p></div>'}`;
}

// Ouvre son propre passage de stagiaire (vue stagiaire classique) depuis « Mon parcours »,
// sans repasser par un code de session.
async function ouvrirMonStage(stagiaireId, sessionId) {
  const { data: sess, error } = await sb.from('sessions').select('*').eq('id', sessionId).single();
  if (error) return toast(error.message, false);
  S.session = sess;
  await chargerFormation(sess.formation_id);
  const { data: stag } = await sb.from('stagiaires').select('*').eq('id', stagiaireId).single();
  S.stagiaire = stag;
  $('bandeau-user').textContent = (stag.prenom + ' ' + stag.nom) + ' (mon parcours)';
  ecranAccueilStagiaire();
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
            ${esc(x.a.grade || '')} ${esc(x.a.prenom)} ${esc(x.a.nom)} (${esc(x.a.cis || '')}) — ${libelleRoleQualif(x.q.role)} ${esc(x.q.domaine)}, valide jusqu'au ${x.q.fin_validite}</option>`).join('')}</select>
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
  const utiliseTypes = S.formation.utilise_types_msp;
  const nomStag = id => { const s = S.data.stagiaires.find(x => x.id === id); return s ? s.prenom + ' ' + s.nom : '?'; };
  const libelleType = t => t === 'complexe' ? '🔴 Complexe' : t === 'mineure' ? '🟢 Mineure' : '';
  const lignes = S.data.passages.map(p => {
    const eq = S.data.equipiers.filter(e => e.passage_id === p.id);
    const theme = S.formation.themes.find(t => t.id === p.theme_id);
    return `<tr>
      <td>${p.numero}</td><td>${esc(p.jour)}</td><td>${esc(theme ? theme.libelle : '')}</td>
      ${utiliseTypes ? `<td>${esc(libelleType(p.type_msp))}</td>` : ''}
      <td>${esc(p.sujet || '')}</td><td>${p.evaluateur ? esc(p.evaluateur) : '<span class="statut-eca">À affecter</span>'}</td>
      <td>${eq.map(e => esc(nomStag(e.stagiaire_id)) + (e.evalue ? '' : ' <small>(non évalué)</small>')).join('<br>')}</td>
      <td><button class="btn petit secondaire" onclick="supprPassage(${p.id})">✕</button></td></tr>`;
  }).join('');

  $('session-contenu').innerHTML = `
    <div class="carte">
      <h2>Feuille de garde — passages prévus</h2>
      <div class="table-scroll"><table>
        <tr><th>N°</th><th>Jour</th><th>Thème</th>${utiliseTypes ? '<th>Type MSP</th>' : ''}<th>Sujet</th><th>Évaluateur</th><th>Équipiers</th><th></th></tr>
        ${lignes}
      </table></div>
      <h3>Programmer un passage</h3>
      <div class="ligne">
        <div><label>Jour</label><select id="pa-jour">${joursFormation().map(j => `<option>${j}</option>`).join('')}</select></div>
        <div><label>Thème</label><select id="pa-theme">${S.formation.themes.map(t => `<option value="${t.id}">${esc(t.libelle)}</option>`).join('')}</select></div>
      </div>
      ${utiliseTypes ? `<div class="ligne">
        <div><label>Type de MSP</label><select id="pa-type-msp">
          <option value="">— non défini —</option>
          <option value="mineure">Mineure</option>
          <option value="complexe">Complexe</option>
        </select></div>
      </div>` : ''}
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
      type_msp: (S.formation.utilise_types_msp && $('pa-type-msp')) ? ($('pa-type-msp').value || null) : null,
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
// Vue « tableau de bord du formateur » : ses propres passages + ceux à affecter en priorité,
// les MSP non entièrement évaluées remontent en haut de la liste.
function ongletEvaluations() {
  const nomStag = id => { const s = S.data.stagiaires.find(x => x.id === id); return s ? s.prenom + ' ' + s.nom : '?'; };
  const toutEvalue = p => {
    const eq = S.data.equipiers.filter(e => e.passage_id === p.id && e.evalue);
    return eq.length > 0 && eq.every(e => S.data.evaluations.some(ev => ev.passage_id === p.id && ev.stagiaire_id === e.stagiaire_id));
  };

  let passages = S.data.passages.filter(p => S.data.equipiers.some(e => e.passage_id === p.id && e.evalue));

  // Vision formateur : n'afficher que ses propres passages + ceux encore à affecter,
  // pour ne pas polluer sa lecture avec les passages des collègues.
  if (S.vision === 'formateur' && S.user) {
    passages = passages.filter(p => !p.evaluateur || p.evaluateur === S.user.nom);
  }

  // Priorité aux MSP non entièrement évaluées, puis par numéro
  passages = passages.slice().sort((a, b) => {
    const da = toutEvalue(a) ? 1 : 0, db = toutEvalue(b) ? 1 : 0;
    return da !== db ? da - db : a.numero - b.numero;
  });

  const blocs = passages.map(p => {
    const theme = S.formation.themes.find(t => t.id === p.theme_id);
    const eq = S.data.equipiers.filter(e => e.passage_id === p.id && e.evalue);
    const complet = toutEvalue(p);
    return `<div class="carte" style="${complet ? 'opacity:.7' : ''}">
      <h3>Passage n°${p.numero} · ${esc(p.jour)} · ${esc(theme ? theme.libelle : '')} ${p.sujet ? '· ' + esc(p.sujet) : ''}
        ${complet ? '<span class="niv niv-A">complet ✓</span>' : '<span class="niv niv-NE">à évaluer</span>'}</h3>
      <div class="info">Évaluateur : ${p.evaluateur
        ? esc(p.evaluateur) + (S.user && p.evaluateur === S.user.nom ? ' (vous)' : '')
        : `<span class="statut-eca">à affecter</span> <button class="btn petit" onclick="prendrePassage(${p.id})">🙋 Je prends ce passage</button>`}</div>
      <div class="info">${eq.map(e => {
        const fait = S.data.evaluations.some(ev => ev.passage_id === p.id && ev.stagiaire_id === e.stagiaire_id);
        return esc(nomStag(e.stagiaire_id)) + (fait ? ' ✓' : ' ○');
      }).join(' · ')}</div>
      <button class="btn" onclick="formEvaluationPassage(${p.id})">Évaluer l'équipe (${eq.length})</button>
    </div>`;
  }).join('');
  $('session-contenu').innerHTML = `
    <div class="carte">
      <button class="btn" onclick="formNouvelleMSP()">➕ Nouvelle MSP à évaluer</button>
    </div>
    ${blocs || '<div class="carte"><p class="info">Aucun passage programmé pour le moment.</p></div>'}`;
}

// Création rapide d'une MSP directement depuis l'onglet Évaluations : numéro de passage
// attribué automatiquement, évaluateur = soi-même, puis bascule directement sur la saisie.
function formNouvelleMSP() {
  $('session-contenu').innerHTML = `
    <div class="carte">
      <span class="lien-retour" onclick="ongletEvaluations()">← Retour</span>
      <h2>Nouvelle MSP à évaluer</h2>
      <div class="info">Le numéro de passage est attribué automatiquement.${S.user ? ' Évaluateur : ' + esc(S.user.nom) + '.' : ''}</div>
      <div class="ligne">
        <div><label>Jour</label><select id="pa2-jour">${joursFormation().map(j => `<option>${j}</option>`).join('')}</select></div>
        <div><label>Thème</label><select id="pa2-theme">${S.formation.themes.map(t => `<option value="${t.id}">${esc(t.libelle)}</option>`).join('')}</select></div>
      </div>
      ${S.formation.utilise_types_msp ? `<div class="ligne">
        <div><label>Type de MSP</label><select id="pa2-type-msp">
          <option value="">— non défini —</option>
          <option value="mineure">Mineure</option>
          <option value="complexe">Complexe</option>
        </select></div>
      </div>` : ''}
      <label>Sujet / cas concret</label>
      <input id="pa2-sujet" list="liste-cas2" placeholder="libre ou choisir">
      <datalist id="liste-cas2">${S.formation.cas.map(c => `<option value="${esc(c.libelle)}">`).join('')}</datalist>
      <label>Équipiers du passage</label>
      ${S.data.stagiaires.map(s => `
        <div class="bloc-comp">
          <input type="checkbox" id="pa2-eq-${s.id}" style="width:auto"> ${esc(s.prenom)} ${esc(s.nom)}
        </div>`).join('')}
      <button class="btn" onclick="creerMSPRapide()">Créer et évaluer</button>
    </div>`;
}

async function creerMSPRapide() {
  const equipiers = S.data.stagiaires.filter(s => $('pa2-eq-' + s.id).checked);
  if (!equipiers.length) return toast('Sélectionner au moins un équipier', false);
  // Numéro unique : max en base + contrainte unique (session_id, numero), réessai si collision
  const { data: dernier } = await sb.from('passages').select('numero')
    .eq('session_id', S.session.id).order('numero', { ascending: false }).limit(1);
  let numero = ((dernier && dernier[0]) ? dernier[0].numero : 0) + 1;
  let passage = null, error = null;
  for (let essai = 0; essai < 3; essai++) {
    ({ data: passage, error } = await sb.from('passages').insert({
      session_id: S.session.id, numero,
      jour: $('pa2-jour').value, theme_id: Number($('pa2-theme').value),
      type_msp: (S.formation.utilise_types_msp && $('pa2-type-msp')) ? ($('pa2-type-msp').value || null) : null,
      sujet: $('pa2-sujet').value.trim() || null,
      evaluateur: S.user ? S.user.nom : null,
    }).select().single());
    if (!error) break;
    if (error.code === '23505') { numero++; continue; }
    break;
  }
  if (error) return toast(error.message, false);
  const { error: e2 } = await sb.from('passage_equipiers').insert(
    equipiers.map(s => ({ passage_id: passage.id, stagiaire_id: s.id, evalue: true })));
  if (e2) return toast(e2.message, false);
  await chargerDonneesSession(S.session.id);
  toast('Passage n°' + numero + ' créé');
  formEvaluationPassage(passage.id);
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

// ---------- Évaluation de toute l'équipe d'un passage sur une seule page (pensé mobile) ----------
// Une colonne par équipier (avatar + nom), une ligne par compétence avec un menu déroulant,
// puis APP à proposer / commentaire par équipier en bas de page.
let _evalPassageCourante = null; // {passageId, parStagiaire: {stagId: {notes:{}, app1, app2, app3, commentaire}}}

function initiales(s) {
  return (((s.prenom || '?')[0] || '?') + ((s.nom || '?')[0] || '?')).toUpperCase();
}

function formEvaluationPassage(passageId) {
  const p = S.data.passages.find(x => x.id === passageId);
  const eq = S.data.equipiers.filter(e => e.passage_id === passageId && e.evalue);
  const stags = eq.map(e => S.data.stagiaires.find(s => s.id === e.stagiaire_id)).filter(Boolean);
  if (!stags.length) return toast('Aucun équipier sur ce passage', false);

  _evalPassageCourante = { passageId, parStagiaire: {} };
  let ressentiExistant = null;
  for (const s of stags) {
    const existante = S.data.evaluations.find(ev => ev.passage_id === passageId && ev.stagiaire_id === s.id);
    _evalPassageCourante.parStagiaire[s.id] = {
      notes: existante ? { ...existante.notes } : {},
      app1: existante?.app1 || '', app2: existante?.app2 || '', app3: existante?.app3 || '',
      commentaire: existante?.commentaire || '',
    };
    if (existante && existante.ressenti_formateur != null) ressentiExistant = existante.ressenti_formateur;
  }

  const theme = S.formation.themes.find(t => t.id === p.theme_id);
  const colonneStag = s => `<div class="colonne-stag">
      ${s.photo_url
        ? `<img src="${esc(s.photo_url)}" alt="" class="avatar-stag" style="object-fit:cover">`
        : `<div class="avatar-stag">${esc(initiales(s))}</div>`}
      <div class="nom-stag">${esc(s.prenom)}<br>${esc(s.nom)}</div>
    </div>`;

  $('session-contenu').innerHTML = `
    <div class="carte">
      <span class="lien-retour" onclick="ongletEvaluations()">← Retour aux passages</span>
      <h2>Passage n°${p.numero} · ${esc(p.jour)} · ${esc(theme ? theme.libelle : '')}</h2>
      <div class="info">A+ acquis avec analyse / A acquis / ECA en cours / NA non acquis / NE non évalué. Note : pas encore de photo stagiaire dans l'appli — initiales en attendant.</div>
      <div class="grille-eval-equipe">${stags.map(colonneStag).join('')}</div>
      ${S.formation.competences.map(c => `
        <div class="section-titre" style="margin-top:16px">${esc(c.code)} — ${esc(c.libelle)}</div>
        <div class="grille-eval-equipe">
          ${stags.map(s => `<div class="colonne-stag">
            <select onchange="_evalPassageCourante.parStagiaire[${s.id}].notes[${c.id}] = this.value || undefined">
              <option value="">—</option>
              ${NIVEAUX.map(n => `<option value="${n}" ${_evalPassageCourante.parStagiaire[s.id].notes[c.id] === n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>`).join('')}
        </div>`).join('')}
      <div class="section-titre" style="margin-top:16px">APP à proposer / Commentaire</div>
      <div class="grille-eval-equipe">
        ${stags.map(s => `<div class="colonne-stag">
          <textarea placeholder="APP 1" oninput="_evalPassageCourante.parStagiaire[${s.id}].app1 = this.value">${esc(_evalPassageCourante.parStagiaire[s.id].app1)}</textarea>
          <textarea placeholder="APP 2" oninput="_evalPassageCourante.parStagiaire[${s.id}].app2 = this.value">${esc(_evalPassageCourante.parStagiaire[s.id].app2)}</textarea>
          <textarea placeholder="APP 3" oninput="_evalPassageCourante.parStagiaire[${s.id}].app3 = this.value">${esc(_evalPassageCourante.parStagiaire[s.id].app3)}</textarea>
          <textarea placeholder="Commentaire" oninput="_evalPassageCourante.parStagiaire[${s.id}].commentaire = this.value">${esc(_evalPassageCourante.parStagiaire[s.id].commentaire)}</textarea>
        </div>`).join('')}
      </div>
      <label>Ressenti formateur (0 à 5, pour toute l'équipe de ce passage)</label>
      <select id="ev-ressenti-equipe">${[0, 1, 2, 3, 4, 5].map(n => `<option ${ressentiExistant === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <button class="btn" onclick="enregistrerEvaluationPassage()">Enregistrer l'évaluation de l'équipe</button>
    </div>`;
}

async function enregistrerEvaluationPassage() {
  const ressenti = Number($('ev-ressenti-equipe').value);
  const lignes = Object.entries(_evalPassageCourante.parStagiaire).map(([stagiaireId, d]) => ({
    passage_id: _evalPassageCourante.passageId, stagiaire_id: Number(stagiaireId),
    formateur: S.user ? S.user.nom : null, notes: d.notes, ressenti_formateur: ressenti,
    app1: (d.app1 || '').trim() || null, app2: (d.app2 || '').trim() || null, app3: (d.app3 || '').trim() || null,
    commentaire: (d.commentaire || '').trim() || null,
  }));
  const { error } = await sb.from('evaluations').upsert(lignes, { onConflict: 'passage_id,stagiaire_id' });
  if (error) return toast(error.message, false);
  await chargerDonneesSession(S.session.id);
  toast('Évaluation enregistrée pour toute l\'équipe'); ongletEvaluations();
}

// ---------- Onglet Suivi MSP (livrable 4 : suivi compétence groupe) ----------
// Page 1 (groupe) : consultable par tout l'encadrement (jamais par les stagiaires, cet onglet
// n'existe pas côté vision stagiaire). Page 2 (mots du formateur) : dupliquée côté stagiaire
// (voir ecranAccueilStagiaire) mais filtrée sur ses seuls passages.
// Cellule avec « jauge » façon barre de données Excel (fond en dégradé proportionnel à la valeur)
function celluleBarre(n, max, couleur) {
  if (!n) return `<td>0</td>`;
  const pct = max ? Math.round(n / max * 100) : 0;
  return `<td style="background:linear-gradient(to right, ${couleur} ${pct}%, transparent ${pct}%)">${n}</td>`;
}

let _mspVue = 'competences';

const MSP_SOUS_ONGLETS = [
  ['competences', 'Suivi des compétences'],
  ['mots', 'Mots du formateur'],
  ['formateur', 'Passages / formateur'],
  ['theme', 'Passages / thème'],
  ['cas', 'Passages / cas concret'],
];

function ongletSuiviMSP(vue) {
  if (vue) _mspVue = vue;
  // Chef de centre : uniquement le suivi des compétences (déjà filtré sur son CIS) — les vues
  // par formateur/thème/cas concret concernent toute la promotion et n'ont pas lieu d'être ici.
  if (S.vision === 'chef_centre') {
    $('session-contenu').innerHTML = _mspVueCompetences();
    return;
  }
  const nav = `<div class="onglets" style="margin-bottom:10px">${MSP_SOUS_ONGLETS.map(([id, lbl]) =>
    `<button class="${_mspVue === id ? 'actif' : ''}" onclick="ongletSuiviMSP('${id}')">${lbl}</button>`).join('')}</div>`;
  const rendus = {
    competences: _mspVueCompetences, mots: _mspVueMots,
    formateur: _mspVueFormateur, theme: _mspVueTheme, cas: _mspVueCas,
  };
  $('session-contenu').innerHTML = nav + rendus[_mspVue]();
}

// ---- Suivi des compétences : une colonne par MSP (numéro seul, pour rester lisible) ----
function _mspVueCompetences() {
  // Chef de centre : ne voit que les stagiaires de son propre CIS, pas toute la promotion.
  const stagiaires = S.vision === 'chef_centre' && S.user
    ? S.data.stagiaires.filter(s => s.cis === S.user.cis)
    : S.data.stagiaires;
  const blocs = stagiaires.map(s => {
    const mesPassages = S.data.equipiers.filter(e => e.stagiaire_id === s.id)
      .map(e => S.data.passages.find(p => p.id === e.passage_id)).filter(Boolean).sort((a, b) => a.numero - b.numero);
    if (!mesPassages.length) return '';
    const { bilan } = bilanStagiaire(s.id);
    const lignesComp = S.formation.competences.map(c => {
      const cellules = mesPassages.map(p => {
        const ev = S.data.evaluations.find(x => x.passage_id === p.id && x.stagiaire_id === s.id);
        const n = ev ? ev.notes[c.id] : null;
        return `<td>${n && n !== 'NE' ? `<span class="niv niv-${NIV_CLASSE[n]}">${n}</span>` : '—'}</td>`;
      }).join('');
      const b = bilan[c.id];
      const cls = classeStatutCompetence(b.statut);
      return `<tr><td><span class="code">${esc(c.code)}</span></td>${cellules}<td class="${cls}"><b>${b.statut}</b></td></tr>`;
    }).join('');
    const dec = s.decision_jury === 'valide' ? '<span class="statut-valide">✅ Validé</span>'
      : (s.decision_jury === 'non_valide' ? '<span class="statut-na">❌ Non validé</span>' : '<span class="info">— à décider —</span>');
    return `<h3>${esc(s.prenom)} ${esc(s.nom)}</h3>
      <div class="table-scroll"><table class="table-compacte table-msp-comp">
        <tr><th>Comp.</th>${mesPassages.map(p => `<th>${p.numero}</th>`).join('')}<th>Validation</th></tr>
        ${lignesComp}
      </table></div>
      <p class="info">Décision jury : ${dec}</p>`;
  }).join('');
  return `<div class="carte">
      <div class="info">Chaque colonne = le numéro de la MSP. Validation calculée selon la règle RIOFE (grisée = acquise 2 fois, blanche = a minima ECA).${
        S.vision === 'chef_centre' ? ' Vue restreinte aux stagiaires de ton CIS.' : ''}</div>
      ${blocs || `<p class="info">${S.vision === 'chef_centre' ? 'Aucun stagiaire de ton CIS sur cette session.' : 'Aucun passage enregistré.'}</p>`}
    </div>`;
}

function _mspVueMots() {
  const blocs = S.data.stagiaires.map(s => {
    const mesPassages = S.data.equipiers.filter(e => e.stagiaire_id === s.id)
      .map(e => S.data.passages.find(p => p.id === e.passage_id)).filter(Boolean).sort((a, b) => a.numero - b.numero);
    const lignes = mesPassages.map(p => {
      const ev = S.data.evaluations.find(x => x.passage_id === p.id && x.stagiaire_id === s.id);
      return `<tr><td>MSP n°${p.numero}</td><td>${ev && ev.commentaire ? esc(ev.commentaire) : '—'}</td></tr>`;
    }).join('');
    if (!lignes) return '';
    return `<h3>${esc(s.prenom)} ${esc(s.nom)}</h3><table><tr><th>Passage</th><th>Mot du formateur</th></tr>${lignes}</table>`;
  }).join('');
  return `<div class="carte">
      <div class="info">Chaque stagiaire peut aussi consulter cette page, mais uniquement pour ses propres passages, depuis son espace personnel.</div>
      ${blocs || '<p class="info">Aucun commentaire enregistré.</p>'}
    </div>`;
}

function _mspVueFormateur() {
  const stagiaires = S.data.stagiaires;
  const nomsFormateurs = [...new Set(S.data.evaluations.map(e => e.formateur).filter(Boolean))];
  let max = 1;
  const comptes = stagiaires.map(s => nomsFormateurs.map(f =>
    S.data.evaluations.filter(e => e.stagiaire_id === s.id && e.formateur === f).length));
  comptes.forEach(l => l.forEach(n => { if (n > max) max = n; }));
  const table = nomsFormateurs.length ? `
    <div class="table-scroll"><table class="table-compacte">
      <tr><th>Stagiaire</th>${nomsFormateurs.map(f => `<th>${esc(f)}</th>`).join('')}</tr>
      ${stagiaires.map((s, i) => `<tr><td>${esc(s.prenom)} ${esc(s.nom)}</td>${nomsFormateurs.map((f, j) => celluleBarre(comptes[i][j], max, '#f06292')).join('')}</tr>`).join('')}
    </table></div>` : '<p class="info">Aucune évaluation enregistrée.</p>';
  return `<div class="carte"><div class="info">Nombre de passages évalués, par formateur et par stagiaire.</div>${table}</div>`;
}

function _mspVueTheme() {
  const stagiaires = S.data.stagiaires;
  const themes = S.formation.themes;
  let max = 1;
  const comptes = stagiaires.map(s => themes.map(t =>
    S.data.evaluations.filter(e => {
      const p = S.data.passages.find(x => x.id === e.passage_id);
      return e.stagiaire_id === s.id && p && p.theme_id === t.id;
    }).length));
  comptes.forEach(l => l.forEach(n => { if (n > max) max = n; }));
  const table = themes.length ? `
    <div class="table-scroll"><table class="table-compacte">
      <tr><th>Stagiaire</th>${themes.map(t => `<th>${esc(t.libelle)}</th>`).join('')}</tr>
      ${stagiaires.map((s, i) => `<tr><td>${esc(s.prenom)} ${esc(s.nom)}</td>${themes.map((t, j) => celluleBarre(comptes[i][j], max, '#81c784')).join('')}</tr>`).join('')}
    </table></div>` : '<p class="info">Aucun thème défini pour cette formation.</p>';
  return `<div class="carte"><div class="info">Nombre de passages évalués, par thématique et par stagiaire.</div>${table}</div>`;
}

function _mspVueCas() {
  const stagiaires = S.data.stagiaires;
  const cas = S.formation.cas || [];
  const norm = t => String(t || '').trim().toLowerCase();
  const table = cas.length ? `
    <div class="table-scroll"><table class="table-compacte">
      <tr><th>Stagiaire</th>${cas.map(c => `<th>${esc(c.libelle)}</th>`).join('')}</tr>
      ${stagiaires.map(s => `<tr><td>${esc(s.prenom)} ${esc(s.nom)}</td>${cas.map(c => {
        const n = S.data.evaluations.filter(e => {
          const p = S.data.passages.find(x => x.id === e.passage_id);
          return e.stagiaire_id === s.id && p && norm(p.sujet) === norm(c.libelle);
        }).length;
        return `<td>${n}</td>`;
      }).join('')}</tr>`).join('')}
    </table></div>` : '<p class="info">Aucun cas concret défini pour cette formation.</p>';
  return `<div class="carte">
      <div class="info">Qui est déjà passé sur quel cas concret / MSP imposée — surtout utile pour CA1E1E PPBE et Équipier SUAP, mais disponible dès qu'une formation a des cas concrets définis.</div>
      ${table}
    </div>`;
}

// ---------- Onglet Validation (règles RIOFE) ----------
function classeStatutCompetence(statut) {
  if (statut === 'Validé' || statut === 'Validé (jury)') return 'statut-valide';
  if (statut === 'En cours') return 'statut-eca';
  if (statut === 'Avis du jury') return 'statut-jury';
  if (statut === 'Non validé (jury)') return 'statut-na';
  if (statut === '—') return '';
  return 'statut-na';
}

// Décision du jury pour UNE compétence précise d'UN stagiaire (distincte de s.decision_jury,
// qui est la décision finale globale du stage) — lue dans le jsonb {"<competence_id>": "valide"|"non_valide"}.
function _decisionJuryComp(s, competenceId) {
  const d = (s && s.decisions_jury_competences) || {};
  return d[competenceId] || '';
}

// Statut final affiché pour une compétence : identique au statut RIOFE brut, sauf quand ce
// statut brut est « Avis du jury » — dans ce cas, si le jury a déjà tranché pour CETTE
// compétence précisément (indépendamment des autres compétences en avis du jury du même
// stagiaire), on affiche le résultat de sa décision plutôt que « en attente ».
function _statutFinalCompetence(statutBrut, s, competenceId) {
  if (statutBrut !== 'Avis du jury') return statutBrut;
  const dec = _decisionJuryComp(s, competenceId);
  if (dec === 'valide') return 'Validé (jury)';
  if (dec === 'non_valide') return 'Non validé (jury)';
  return statutBrut;
}

function bilanStagiaire(stagiaireId) {
  const evalsToutes = S.data.evaluations.filter(e => e.stagiaire_id === stagiaireId);
  let evals = evalsToutes;

  // Paramètres du stage (onglet « Paramètres », réservé RP/GFor) : si un nombre de MSP de
  // certification est fixé, seules les N dernières MSP évaluées de ce stagiaire comptent.
  const nbMax = S.session && S.session.nb_msp_certification;
  if (nbMax) {
    const mesPassages = S.data.equipiers.filter(e => e.stagiaire_id === stagiaireId && e.evalue)
      .map(e => S.data.passages.find(p => p.id === e.passage_id)).filter(Boolean)
      .sort((a, b) => a.numero - b.numero);
    const retenus = new Set(mesPassages.slice(-nbMax).map(p => p.id));
    evals = evals.filter(e => retenus.has(e.passage_id));
  }

  const seuilNA = (S.session && S.session.seuil_na_jury) || 2;
  const seuilECA = (S.session && S.session.seuil_eca_jury) || 4;

  // Mode de validation spécifique à certaines formations (ex : CA1E1E — Sergent) : remplace la
  // logique standard « acquis 2 fois » par une condition unique — au moins une MSP taguée
  // « complexe » doit être notée intégralement en A/A+ (aucune ECA/NA/NE), toutes compétences
  // confondues — indépendamment du plafond « nb_msp_certification » ci-dessus (on regarde tout le parcours).
  let mspComplexeSansFaute = null; // null = mode non applicable à cette formation
  if (S.formation && S.formation.mode_validation === 'msp_complexe_sans_faute') {
    mspComplexeSansFaute = evalsToutes.some(ev => {
      const p = S.data.passages.find(pp => pp.id === ev.passage_id);
      if (!p || p.type_msp !== 'complexe') return false;
      const notes = ev.notes || {};
      return S.formation.competences.every(c => notes[c.id] === 'A' || notes[c.id] === 'A+');
    });
  }

  const bilan = {};
  for (const c of S.formation.competences) {
    // aPlus/aSimple comptés séparément (affichage détaillé dans l'onglet Validation) ; acquis
    // = les deux confondus, seule valeur utilisée par les règles de validation ci-dessous.
    let aPlus = 0, aSimple = 0, eca = 0, na = 0;
    for (const ev of evals) {
      const n = ev.notes[c.id];
      if (n === 'A+') aPlus++;
      else if (n === 'A') aSimple++;
      else if (n === 'ECA') eca++;
      else if (n === 'NA') na++;
    }
    const acquis = aPlus + aSimple;
    // Règle RIOFE : case grisée = « acquise » 2 fois ; case blanche = a minima ECA ;
    // au-delà des seuils NA/ECA réglés dans les Paramètres du stage, la validation relève de l'avis du jury.
    // (sauf mode_validation « msp_complexe_sans_faute », qui remplace entièrement cette logique)
    let statut;
    if (mspComplexeSansFaute !== null) {
      statut = mspComplexeSansFaute ? 'Validé' : (acquis + eca + na > 0 ? 'En cours' : '—');
    } else if (na >= seuilNA || eca >= seuilECA) {
      statut = 'Avis du jury';
    } else if (c.grisee) {
      statut = acquis >= 2 ? 'Validé' : (acquis + eca + na > 0 ? 'En cours' : '—');
    } else {
      statut = acquis > 0 || eca > 0 ? 'Validé' : (na > 0 ? 'Non acquis' : '—');
    }
    if (mspComplexeSansFaute === null && na === 1 && statut !== 'Validé' && statut !== 'Avis du jury') statut = 'Alerte NA';
    bilan[c.id] = { acquis, aPlus, aSimple, eca, na, statut };
  }
  return { bilan, nbPassages: evals.length, mspComplexeSansFaute };
}

// ---------- Onglet Paramètres du stage (réservé RP/GFor) ----------
function ongletParametresStage() {
  if (!(S.vision === 'rp' || S.vision === 'gfor')) {
    $('session-contenu').innerHTML = '<div class="carte"><p class="info">Réservé au responsable pédagogique et au GFor.</p></div>';
    return;
  }
  const sess = S.session;
  $('session-contenu').innerHTML = `
    <div class="carte">
      <h2>Paramètres du stage</h2>
      <div class="info">Réglages visibles et modifiables uniquement par le RP et le GFor. Ils s'appliquent immédiatement au calcul de validation (onglets Validation et Suivi MSP).</div>
      <label>Seuil NA déclenchant un avis du jury (nombre de « NA » sur une même compétence)</label>
      <input id="pr-seuil-na" type="number" min="1" value="${sess.seuil_na_jury ?? 2}">
      <label>Seuil ECA déclenchant un avis du jury (nombre de « ECA » sur une même compétence)</label>
      <input id="pr-seuil-eca" type="number" min="1" value="${sess.seuil_eca_jury ?? 4}">
      <label>Nombre de MSP prises en compte pour la certification</label>
      <input id="pr-nb-msp" type="number" min="1" placeholder="Laisser vide = toutes les MSP" value="${sess.nb_msp_certification ?? ''}">
      <div class="info">Si renseigné (ex. 5) : pour chaque stagiaire, seules ses N dernières MSP évaluées (les plus récentes, par numéro de passage) comptent pour la validation des compétences — même si le stagiaire en a fait davantage.</div>
      <button class="btn" onclick="enregistrerParametresStage()">Enregistrer</button>
    </div>`;
}

async function enregistrerParametresStage() {
  const seuilNA = Number($('pr-seuil-na').value) || 2;
  const seuilECA = Number($('pr-seuil-eca').value) || 4;
  const nbMspRaw = $('pr-nb-msp').value.trim();
  const nbMsp = nbMspRaw ? Number(nbMspRaw) : null;
  const { error } = await sb.from('sessions').update({
    seuil_na_jury: seuilNA, seuil_eca_jury: seuilECA, nb_msp_certification: nbMsp,
  }).eq('id', S.session.id);
  if (error) return toast(error.message, false);
  S.session.seuil_na_jury = seuilNA; S.session.seuil_eca_jury = seuilECA; S.session.nb_msp_certification = nbMsp;
  toast('Paramètres du stage enregistrés');
}

function ongletValidation() {
  const comps = S.formation.competences;
  const modeSansFaute = S.formation.mode_validation === 'msp_complexe_sans_faute';
  const lignes = S.data.stagiaires.map(s => {
    const { bilan, nbPassages, mspComplexeSansFaute } = bilanStagiaire(s.id);
    const cellules = comps.map(c => {
      const b = bilan[c.id];
      // Quand cette compétence précise est en « Avis du jury » (trop de ECA/NA sur elle,
      // indépendamment des autres compétences du même stagiaire), on affiche un sélecteur
      // dédié pour trancher CETTE compétence — plusieurs compétences en avis du jury sur un
      // même stagiaire peuvent être validées séparément, ce n'est pas une décision globale.
      const statutFinal = _statutFinalCompetence(b.statut, s, c.id);
      const cls = classeStatutCompetence(statutFinal);
      const decComp = _decisionJuryComp(s, c.id);
      // Sélecteur volontairement compact (classe .select-jury-comp, largeur bridée en CSS) :
      // avec des libellés complets et une largeur "auto", chaque case s'élargissait au texte
      // le plus long du menu déroulant et le tableau débordait bien plus qu'avant ce sélecteur.
      const selecteurJury = b.statut === 'Avis du jury' ? `
        <br><select class="select-jury-comp" onchange="enregistrerDecisionJuryCompetence(${s.id}, ${c.id}, this.value)" title="Décision du jury pour cette compétence précisément">
          <option value="" ${decComp === '' ? 'selected' : ''}>— en attente —</option>
          <option value="valide" ${decComp === 'valide' ? 'selected' : ''}>✅ Validée</option>
          <option value="non_valide" ${decComp === 'non_valide' ? 'selected' : ''}>❌ Non validée</option>
        </select>` : '';
      // Détail des notes empilé verticalement (une ligne par catégorie) plutôt qu'un résumé
      // horizontal type « 9A/1E/1N » : chaque ligne est plus courte, donc la colonne reste étroite.
      return `<td class="${cls}" title="acquis:${b.acquis} ECA:${b.eca} NA:${b.na}">${statutFinal}<br>
        <small>${b.aPlus} A+<br>${b.aSimple} A<br>${b.eca} ECA<br>${b.na} NA</small>${selecteurJury}</td>`;
    }).join('');
    const okMsp = nbPassages >= S.formation.nb_msp_min;
    const dec = s.decision_jury || '';
    return `<tr><td><b>${esc(s.prenom)} ${esc(s.nom)}</b><br>
      <small class="${okMsp ? 'statut-valide' : 'statut-na'}">${nbPassages}/${S.formation.nb_msp_min} MSP évaluées</small>
      ${modeSansFaute ? `<br><small class="${mspComplexeSansFaute ? 'statut-valide' : 'statut-na'}">${mspComplexeSansFaute ? '✅ MSP complexe sans faute' : '❌ pas encore de MSP complexe sans faute'}</small>` : ''}<br>
      <button class="btn petit secondaire" style="margin-top:4px" onclick="genererFicheSuivi(${s.id})">📄 Fiche PDF</button>
      <button class="btn petit secondaire" style="margin-top:4px" onclick="genererLivretCertification(${s.id})">📘 Livret</button></td>${cellules}
      <td><select onchange="enregistrerDecisionJury(${s.id}, this.value)" style="width:auto">
        <option value="" ${dec === '' ? 'selected' : ''}>— À décider —</option>
        <option value="valide" ${dec === 'valide' ? 'selected' : ''}>✅ Validé</option>
        <option value="non_valide" ${dec === 'non_valide' ? 'selected' : ''}>❌ Non validé</option>
      </select></td></tr>`;
  }).join('');

  $('session-contenu').innerHTML = `
    <div class="carte">
      <h2>Validation des compétences</h2>
      <div class="info">${modeSansFaute
        ? `Règle spécifique à cette formation : validation conditionnée à au moins une MSP « complexe » notée intégralement en A/A+ (aucune ECA/NA/NE), toutes compétences confondues. ${S.formation.nb_msp_min} MSP évaluées minimum par stagiaire.`
        : `Règle RIOFE : compétence grisée = « acquise » (A ou A+) 2 fois minimum · ${S.formation.nb_msp_min} MSP évaluées minimum par stagiaire. Détail par case : nb Acquis / ECA / NA.`}
        Quand une case passe en « Avis du jury » (trop de ECA/NA sur cette compétence précisément), un sélecteur apparaît directement dans la case pour trancher CETTE compétence — sur plusieurs avis du jury, certaines compétences peuvent être validées et d'autres non, indépendamment les unes des autres.
        La colonne « Décision jury » à droite reste la décision finale globale de la commission de certification pour l'ensemble du stage.</div>
      <div class="table-scroll"><table class="table-validation">
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

// Décision du jury pour UNE compétence précise (statut « Avis du jury »), indépendante de la
// décision finale globale du stage ci-dessus — sur plusieurs avis du jury, chaque compétence
// se tranche séparément.
async function enregistrerDecisionJuryCompetence(stagiaireId, competenceId, valeur) {
  const s = S.data.stagiaires.find(x => x.id === stagiaireId);
  if (!s) return;
  const decisions = { ...(s.decisions_jury_competences || {}) };
  if (valeur) decisions[competenceId] = valeur; else delete decisions[competenceId];
  const { error } = await sb.from('stagiaires').update({ decisions_jury_competences: decisions }).eq('id', stagiaireId);
  if (error) return toast(error.message, false);
  s.decisions_jury_competences = decisions;
  toast('Décision jury enregistrée pour cette compétence');
  ongletValidation();
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

// ============================================================
// PARAMÈTRES FORMATIONS (GFor) — réglage global, indépendant des sessions :
// création de formation, seuils A/ECA/NA par défaut, barème RP/formateurs
// vis-à-vis du nombre de stagiaires (RIOFE), nombre de jours, compétences.
// ============================================================
let _baremeEnCours = [];

async function ecranParametresFormations() {
  majMenu('param-form');
  show('ecran-staff-accueil');
  const { data: formations, error } = await sb.from('formations').select('*').order('libelle');
  if (error) return toast(error.message, false);
  window._formations = formations || [];

  const lignes = (formations || []).map(f => `<tr>
      <td><span class="badge" style="background:${esc(f.couleur)};color:#fff">${esc(f.domaine)}</span></td>
      <td><b>${esc(f.libelle)}</b> <span class="info">(${esc(f.code)})</span>${f.actif ? '' : ' <span class="info">— inactive</span>'}</td>
      <td>${f.nb_jours}</td>
      <td>${f.nb_stagiaires_max}</td>
      <td>${f.nb_msp_min} (+${f.nb_msp_rattrapage} rattrap.)</td>
      <td>${f.mode_validation === 'msp_complexe_sans_faute' ? '<span class="badge" style="background:#6a1b9a;color:#fff">MSP complexe sans faute</span>' : `NA ≥ ${f.seuil_na_jury_defaut ?? 2} / ECA ≥ ${f.seuil_eca_jury_defaut ?? 4}`}</td>
      <td style="white-space:nowrap">
        <button class="btn petit secondaire" onclick="ecranFormulaireFormation(${f.id})">✏️</button>
        <button class="btn petit secondaire" onclick="ecranCompetencesFormation(${f.id})">📋 Compétences</button>
      </td>
    </tr>`).join('');

  $('staff-dashboard').innerHTML = `<div class="carte">
    <h2>Paramètres formations</h2>
    <div class="info">Réglages généraux, valables pour toutes les sessions à venir de la formation (le RP/GFor peut encore affiner NA/ECA session par session dans l'onglet « Paramètres » de chaque session).</div>
    <div class="table-scroll"><table>
      <tr><th>Domaine</th><th>Formation</th><th>Jours</th><th>Stag. (indicatif)</th><th>MSP requises</th><th>Avis du jury si</th><th></th></tr>
      ${lignes}
    </table></div>
    <button class="btn" onclick="ecranFormulaireFormation()">➕ Nouvelle formation</button>
  </div>`;
}

function _rendreBaremeEnCours() {
  $('fm-bareme-liste').innerHTML = _baremeEnCours.map((t, i) => `<div class="ligne" style="align-items:center">
      <span>de <b>${t.min}</b> à <b>${t.max}</b> stagiaires → <b>${t.formateurs}</b> formateur(s)</span>
      <a onclick="_baremeEnCours.splice(${i},1);_rendreBaremeEnCours()" style="cursor:pointer;color:var(--warn);font-weight:bold"> ✕</a>
    </div>`).join('') || '<p class="info">Aucune tranche définie — le calcul du besoin en formateurs sera désactivé.</p>';
}

function ajouterTrancheBareme() {
  const min = Number($('fm-bar-min').value), max = Number($('fm-bar-max').value), formateurs = Number($('fm-bar-form').value);
  if (!min || !max || max < min || !formateurs) return toast('Tranche invalide (min/max/formateurs)', false);
  _baremeEnCours.push({ min, max, formateurs });
  _baremeEnCours.sort((a, b) => a.min - b.min);
  $('fm-bar-min').value = ''; $('fm-bar-max').value = ''; $('fm-bar-form').value = '';
  _rendreBaremeEnCours();
}

function ecranFormulaireFormation(id) {
  const f = id ? (window._formations || []).find(x => x.id === id) : null;
  _baremeEnCours = f ? JSON.parse(JSON.stringify(f.bareme_formateurs || [])) : [];
  $('staff-dashboard').innerHTML = `<div class="carte">
    <span class="lien-retour" onclick="ecranParametresFormations()">← Retour aux paramètres formations</span>
    <h2>${f ? 'Modifier — ' + esc(f.libelle) : 'Nouvelle formation'}</h2>
    <div class="ligne">
      <div><label>Code (ex : SUAP)</label><input id="fm-code" value="${esc(f?.code || '')}"></div>
      <div><label>Libellé</label><input id="fm-libelle" value="${esc(f?.libelle || '')}"></div>
    </div>
    <div class="ligne">
      <div><label>Domaine (affichage)</label><select id="fm-domaine">${DOMAINES_COMP.map(d => `<option ${d === f?.domaine ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
      <div><label>Couleur (badge)</label><input id="fm-couleur" type="color" value="${esc(f?.couleur || '#607d8b')}"></div>
    </div>
    <div class="ligne">
      <div><label>Nombre de jours de formation</label><input id="fm-jours" type="number" min="1" value="${f?.nb_jours ?? 5}"></div>
      <div><label>Nombre de stagiaires (valeur indicative par défaut)</label><input id="fm-stagmax" type="number" min="1" value="${f?.nb_stagiaires_max ?? 12}">
        <div class="info">Ce n'est pas un plafond réglementaire fixe : le nombre réel de stagiaires par session dépend de l'équipe pédagogique. Cette valeur ne sert que d'estimation par défaut (jauge du tableau de bord) tant que les stagiaires ne sont pas encore inscrits. Le besoin réel en formateurs est calculé via le barème d'encadrement ci-dessous, quel que soit l'effectif réel.</div></div>
    </div>
    <div class="ligne">
      <div><label>Nombre de MSP requises</label><input id="fm-mspmin" type="number" min="1" value="${f?.nb_msp_min ?? 4}"></div>
      <div><label>Dont MSP de rattrapage</label><input id="fm-msprattrap" type="number" min="0" value="${f?.nb_msp_rattrapage ?? 1}"></div>
    </div>
    <div class="ligne">
      <div><label>Nombre de RP requis</label><input id="fm-nbrp" type="number" min="1" value="${f?.nb_rp_requis ?? 1}"></div>
      <div><label>Formation active</label><select id="fm-actif"><option value="true" ${f?.actif !== false ? 'selected' : ''}>Oui</option><option value="false" ${f?.actif === false ? 'selected' : ''}>Non</option></select></div>
    </div>

    <h3>Avis du jury — seuils par défaut</h3>
    <div class="info">Nombre de ECA ou de NA sur une même compétence à partir duquel la validation passe en « Avis du jury ». Valeur reprise à la création de chaque nouvelle session de cette formation (réglable ensuite session par session). Sans effet si le mode de validation ci-dessous est réglé sur « MSP complexe sans faute ».</div>
    <div class="ligne">
      <div><label>Nombre de NA</label><input id="fm-seuil-na" type="number" min="1" value="${f?.seuil_na_jury_defaut ?? 2}"></div>
      <div><label>Nombre de ECA</label><input id="fm-seuil-eca" type="number" min="1" value="${f?.seuil_eca_jury_defaut ?? 4}"></div>
    </div>

    <h3>Types de MSP et mode de validation</h3>
    <div class="info">Fonctionnalité optionnelle, activable formation par formation (ex : CA1E1E — Sergent). Une fois activée, chaque MSP programmée peut être étiquetée « mineure » ou « complexe ».</div>
    <label><input type="checkbox" id="fm-types-msp" style="width:auto" ${f?.utilise_types_msp ? 'checked' : ''} onchange="$('fm-mode-validation-ligne').style.display = this.checked ? '' : 'none'"> Utiliser les types de MSP (mineure / complexe) pour cette formation</label>
    <div class="ligne" id="fm-mode-validation-ligne" style="display:${f?.utilise_types_msp ? '' : 'none'}">
      <div><label>Mode de validation</label>
        <select id="fm-mode-validation">
          <option value="standard" ${(!f || f.mode_validation === 'standard') ? 'selected' : ''}>Standard (règles RIOFE habituelles — acquis 2 fois / seuils NA-ECA)</option>
          <option value="msp_complexe_sans_faute" ${f?.mode_validation === 'msp_complexe_sans_faute' ? 'selected' : ''}>MSP complexe sans faute (remplace la règle standard — au moins une MSP complexe notée intégralement A/A+)</option>
        </select>
      </div>
    </div>

    <h3>Barème d'encadrement (RIOFE) — RP/formateurs vis-à-vis du nombre de stagiaires</h3>
    <div id="fm-bareme-liste" style="margin-bottom:8px"></div>
    <div class="ligne">
      <div><label>De (stagiaires)</label><input id="fm-bar-min" type="number" min="1"></div>
      <div><label>À (stagiaires)</label><input id="fm-bar-max" type="number" min="1"></div>
      <div><label>Formateurs requis</label><input id="fm-bar-form" type="number" min="1"></div>
      <div style="align-self:flex-end"><button class="btn petit" onclick="ajouterTrancheBareme()">➕ Ajouter</button></div>
    </div>

    <button class="btn" style="margin-top:16px" onclick="enregistrerFormation(${f ? f.id : 'null'})">Enregistrer la formation</button>
  </div>`;
  _rendreBaremeEnCours();
}

async function enregistrerFormation(id) {
  const code = $('fm-code').value.trim().toUpperCase();
  const libelle = $('fm-libelle').value.trim();
  if (!code || !libelle) return toast('Code et libellé requis', false);
  const payload = {
    code, libelle,
    domaine: $('fm-domaine').value,
    couleur: $('fm-couleur').value,
    nb_jours: Number($('fm-jours').value) || 5,
    nb_stagiaires_max: Number($('fm-stagmax').value) || 12,
    nb_msp_min: Number($('fm-mspmin').value) || 4,
    nb_msp_rattrapage: Number($('fm-msprattrap').value) || 0,
    nb_rp_requis: Number($('fm-nbrp').value) || 1,
    actif: $('fm-actif').value === 'true',
    seuil_na_jury_defaut: Number($('fm-seuil-na').value) || 2,
    seuil_eca_jury_defaut: Number($('fm-seuil-eca').value) || 4,
    bareme_formateurs: _baremeEnCours,
    utilise_types_msp: $('fm-types-msp').checked,
    mode_validation: $('fm-types-msp').checked ? $('fm-mode-validation').value : 'standard',
  };
  const req = id ? sb.from('formations').update(payload).eq('id', id) : sb.from('formations').insert(payload);
  const { error } = await req;
  if (error) return toast(error.message, false);
  toast(id ? 'Formation mise à jour' : 'Formation créée');
  ecranParametresFormations();
}

// ---------- Compétences d'une formation (référentiel RIOFE) ----------
async function ecranCompetencesFormation(formationId) {
  const f = (window._formations || []).find(x => x.id === formationId);
  const { data: comp, error } = await sb.from('competences').select('*').eq('formation_id', formationId).order('ordre');
  if (error) return toast(error.message, false);
  window._competences = comp || [];

  const lignes = (comp || []).map(c => `<tr>
      <td><input value="${esc(c.ordre)}" type="number" style="width:56px" id="cp-ordre-${c.id}"></td>
      <td><input value="${esc(c.code)}" style="width:70px" id="cp-code-${c.id}"></td>
      <td><input value="${esc(c.libelle)}" id="cp-lib-${c.id}"></td>
      <td style="text-align:center"><input type="checkbox" id="cp-grisee-${c.id}" ${c.grisee ? 'checked' : ''} style="width:auto"></td>
      <td style="white-space:nowrap">
        <button class="btn petit secondaire" onclick="enregistrerCompetence(${c.id})">💾</button>
        <button class="btn petit secondaire" onclick="supprCompetence(${c.id})">✕</button>
      </td>
    </tr>`).join('');

  $('staff-dashboard').innerHTML = `<div class="carte">
    <span class="lien-retour" onclick="ecranParametresFormations()">← Retour aux paramètres formations</span>
    <h2>Compétences — ${esc(f ? f.libelle : '')}</h2>
    <div class="info">Compétence « grisée » (RIOFE) : doit être acquise 2 fois pour être validée. Sinon, un seul acquis/ECA suffit.</div>
    <div class="table-scroll"><table>
      <tr><th>Ordre</th><th>Code</th><th>Libellé</th><th>Grisée</th><th></th></tr>
      ${lignes}
    </table></div>
    <h3>Ajouter une compétence</h3>
    <div class="ligne">
      <div><label>Ordre</label><input id="cp-new-ordre" type="number" value="${(comp || []).length + 1}"></div>
      <div><label>Code</label><input id="cp-new-code" placeholder="ex : C8"></div>
      <div><label>Libellé</label><input id="cp-new-lib"></div>
      <div><label>Grisée</label><input type="checkbox" id="cp-new-grisee" checked style="width:auto"></div>
      <div style="align-self:flex-end"><button class="btn petit" onclick="ajouterCompetence(${formationId})">➕ Ajouter</button></div>
    </div>
  </div>`;
}

async function enregistrerCompetence(id) {
  const { error } = await sb.from('competences').update({
    ordre: Number($('cp-ordre-' + id).value) || 1,
    code: $('cp-code-' + id).value.trim(),
    libelle: $('cp-lib-' + id).value.trim(),
    grisee: $('cp-grisee-' + id).checked,
  }).eq('id', id);
  if (error) return toast(error.message, false);
  toast('Compétence mise à jour');
}

async function ajouterCompetence(formationId) {
  const code = $('cp-new-code').value.trim(), libelle = $('cp-new-lib').value.trim();
  if (!code || !libelle) return toast('Code et libellé requis', false);
  const { error } = await sb.from('competences').insert({
    formation_id: formationId, code, libelle,
    ordre: Number($('cp-new-ordre').value) || 1,
    grisee: $('cp-new-grisee').checked,
  });
  if (error) return toast(error.message, false);
  toast('Compétence ajoutée');
  ecranCompetencesFormation(formationId);
}

async function supprCompetence(id) {
  if (!confirm('Supprimer cette compétence ? Les évaluations déjà enregistrées sur cette compétence resteront en base mais ne seront plus rattachées à un référentiel affiché.')) return;
  const { error } = await sb.from('competences').delete().eq('id', id);
  if (error) return toast(error.message, false);
  const formationId = (window._competences || []).find(c => c.id === id)?.formation_id;
  toast('Compétence supprimée');
  if (formationId) ecranCompetencesFormation(formationId);
  else ecranParametresFormations();
}
