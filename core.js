// core.js — LE SOCLE. Connexion Supabase, login staff, entrée stagiaire, navigation.
// ⚠️ Ce fichier ne bouge que pour une bonne raison. Le métier vit dans app.js.

// ======= CONFIGURATION — À REMPLACER (Supabase > Settings > API) =======
const SUPABASE_URL = 'https://mpcehmbocrbhmczvrukm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uCzxHKlFH_SlnZmxAEvu9Q_mBv-iBY8';
// =======================================================================

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// État global partagé avec app.js
const S = {
  user: null,        // profil staff connecté {id, nom, role, cis}
  stagiaire: null,   // stagiaire connecté par code {id, nom, prenom, session_id}
  session: null,     // session courante (objet complet)
  formation: null,   // formation + référentiel {competences, criteres, themes, cas}
};

// ---------- Navigation : montre un écran, cache les autres ----------
function show(id) {
  document.querySelectorAll('.ecran').forEach(e => e.classList.remove('actif'));
  const el = document.getElementById(id);
  if (el) el.classList.add('actif');
  window.scrollTo(0, 0);
}

// ---------- Helpers ----------
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(msg, ok = true) {
  const t = document.createElement('div');
  t.className = 'toast ' + (ok ? 'ok' : 'ko');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ---------- Chargement du référentiel d'une formation ----------
async function chargerFormation(formationId) {
  const [f, comp, crit, th, cas] = await Promise.all([
    sb.from('formations').select('*').eq('id', formationId).single(),
    sb.from('competences').select('*').eq('formation_id', formationId).order('ordre'),
    sb.from('criteres').select('*').eq('formation_id', formationId).order('ordre'),
    sb.from('themes').select('*').eq('formation_id', formationId).order('libelle'),
    sb.from('cas_concrets').select('*').eq('formation_id', formationId).order('libelle'),
  ]);
  for (const r of [f, comp, crit, th, cas]) if (r.error) throw r.error;
  S.formation = { ...f.data, competences: comp.data, criteres: crit.data, themes: th.data, cas: cas.data };
}

// ---------- Login staff (email + mot de passe) ----------
async function loginStaff() {
  const email = $('login-email').value.trim();
  const mdp = $('login-mdp').value;
  if (!email || !mdp) return toast('Email et mot de passe requis', false);
  const { error } = await sb.auth.signInWithPassword({ email, password: mdp });
  if (error) return toast('Connexion refusée : ' + error.message, false);
  await chargerProfil();
}

async function chargerProfil() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  let { data: profil } = await sb.from('profils').select('*').eq('id', user.id).maybeSingle();

  // Pas de profil : création automatique depuis la liste d'aptitude (par l'email)
  if (!profil) {
    const { data: apt } = await sb.from('aptitudes').select('*, qualifications(*)').ilike('email', user.email || '').limit(1);
    if (apt && apt.length) {
      const a = apt[0];
      const quals = a.qualifications || [];
      const estRP = quals.some(q => q.role === 'rp');
      // a.gfor / a.chef_centre (cases à cocher dans la liste d'aptitude) permettent de donner ces
      // accès sans passer par la base — sinon rôle déduit des qualifications (RP > Formateur).
      // Une personne sans aucune qualification (ex : simple recrue pas encore formée) est
      // considérée comme stagiaire par défaut plutôt que formateur.
      const role = a.gfor ? 'gfor' : a.chef_centre ? 'chef_centre' : estRP ? 'rp' : (quals.length ? 'formateur' : 'stagiaire');
      const ins = await sb.from('profils').insert({
        id: user.id, nom: a.prenom + ' ' + a.nom, email: user.email,
        role, cis: a.cis,
      }).select().single();
      if (ins.error) debugShow('Création de profil impossible : ' + JSON.stringify(ins.error));
      profil = ins.data;
    }
  }
  if (!profil) {
    toast('Adresse email absente de la liste d\'aptitude — contacter le GFor.', false);
    await sb.auth.signOut();
    show('ecran-login');
    return;
  }
  S.user = profil;
  S.vision = profil.role;
  // « Vue globale » par défaut uniquement pour le GFor (même pendant le développement/tests) —
  // pour les autres rôles (RP, formateur, chef de centre), le filtrage sur leurs propres
  // sessions/CIS s'applique par défaut, sans quoi il n'aurait aucun effet (pas de case à cocher
  // pour eux pour le désactiver).
  S.omniscient = profil.role === 'gfor';
  if ($('bandeau-user')) $('bandeau-user').textContent = profil.nom;
  if ($('btn-logout')) $('btn-logout').style.display = '';
  // Un rôle donne accès à sa vision et à celles en dessous
  const hierarchie = {
    gfor: ['gfor', 'rp', 'formateur', 'stagiaire'],
    rp: ['rp', 'formateur', 'stagiaire'],
    formateur: ['formateur', 'stagiaire'],
    chef_centre: ['chef_centre'],
  };
  const visions = hierarchie[profil.role] || [profil.role];
  const sel = $('sel-vision');
  // ⚠ Les éléments ci-dessous (sel-vision, lbl-omniscient, chk-omniscient) n'existent que si
  // index.html a bien été ré-uploadé après leur ajout — on protège chaque accès pour qu'un
  // décalage de déploiement (JS à jour, HTML pas encore ré-uploadé) ne fasse jamais planter
  // toute l'appli (page blanche), seulement cette fonctionnalité précise.
  if (sel) {
    sel.innerHTML = visions.map(r => '<option value="' + r + '">Vision : ' + libelleRole(r) + '</option>').join('');
    sel.style.display = visions.length > 1 ? '' : 'none';
  }
  // « Vue globale » : réservé au GFor, permet de basculer entre voir toutes les sessions (dev/tests)
  // et ne voir que celles où l'on est réellement déclaré RP/Formateur (pour tester en conditions réelles).
  if ($('lbl-omniscient')) $('lbl-omniscient').style.display = profil.role === 'gfor' ? '' : 'none';
  if ($('chk-omniscient')) $('chk-omniscient').checked = true;
  // Un profil « stagiaire » pur (aucune qualification formateur/RP) atterrit directement sur
  // son propre parcours, sans tableau de bord d'encadrement.
  if (profil.role === 'stagiaire') ecranMonParcoursStagiaire();
  else ecranAccueilStaff(); // défini dans app.js
}

function toggleOmniscient(v) {
  S.omniscient = v;
  ecranAccueilStaff();
}

function libelleRole(r) {
  return { rp: 'Resp. pédagogique', formateur: 'Formateur', gfor: 'GFOR', chef_centre: 'Chef de centre', stagiaire: 'Stagiaire' }[r] || r;
}

async function logout() {
  await sb.auth.signOut();
  S.user = null; S.stagiaire = null; S.session = null; S.vision = null;
  if ($('bandeau-user')) $('bandeau-user').textContent = '';
  if ($('btn-logout')) $('btn-logout').style.display = 'none';
  if ($('sel-vision')) $('sel-vision').style.display = 'none';
  if ($('lbl-omniscient')) $('lbl-omniscient').style.display = 'none';
  if ($('menu-gauche')) $('menu-gauche').style.display = 'none';
  show('ecran-login');
}

async function motDePasseOublie() {
  const email = $('login-email').value.trim().toLowerCase();
  if (!email) return toast('Saisir d\'abord ton email dans le champ ci-dessus', false);
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  toast(error ? error.message : 'Email de réinitialisation envoyé à ' + email, !error);
}

// Retour du lien de réinitialisation : demande du nouveau mot de passe
sb.auth.onAuthStateChange(async (event) => {
  if (event === 'PASSWORD_RECOVERY') {
    const np = prompt('Nouveau mot de passe (6 caractères minimum) :');
    if (np && np.length >= 6) {
      const { error } = await sb.auth.updateUser({ password: np });
      toast(error ? error.message : 'Mot de passe mis à jour', !error);
      if (!error) await chargerProfil();
    }
  }
});

// ---------- Entrée stagiaire (code session + choix du nom) ----------
// codeForce : utilisé par le lien direct du chevalet (QR code, ?code=XXXX en URL) pour entrer
// directement sans ressaisie, sans dépendre de la valeur du champ #stag-code.
async function entreeStagiaireCode(codeForce) {
  const code = (codeForce || $('stag-code').value.trim()).toUpperCase();
  if (!code) return toast('Saisir le code de session', false);
  const { data: sess, error } = await sb.from('sessions').select('*').eq('code_acces', code).single();
  if (error || !sess) return toast('Code de session inconnu', false);
  S.session = sess;
  await chargerFormation(sess.formation_id);
  const { data: stags } = await sb.from('stagiaires').select('*').eq('session_id', sess.id).order('nom');
  $('stag-liste').innerHTML = stags.map(s =>
    `<button class="btn-liste" onclick="entreeStagiaireNom(${s.id})">${esc(s.prenom)} ${esc(s.nom)}</button>`
  ).join('');
  show('ecran-stag-nom');
  window._stags = stags;
}

async function entreeStagiaireNom(id) {
  S.stagiaire = window._stags.find(s => s.id === id);
  if ($('bandeau-user')) $('bandeau-user').textContent = S.stagiaire.prenom + ' ' + S.stagiaire.nom + ' (stagiaire)';
  if ($('btn-logout')) $('btn-logout').style.display = '';
  ecranAccueilStagiaire(); // défini dans app.js
}

// ---------- Démarrage ----------
window.addEventListener('DOMContentLoaded', async () => {
  if (SUPABASE_URL.includes('VOTRE-PROJET')) {
    debugShow('CONFIGURATION MANQUANTE : renseigner SUPABASE_URL et SUPABASE_ANON_KEY en haut de core.js');
    return;
  }
  const { data: { session } } = await sb.auth.getSession();
  if (session) { await chargerProfil(); return; }
  show('ecran-login');

  // Lien direct chevalet (QR code) : ?code=XXXX pré-remplit et lance directement l'entrée
  // stagiaire, sans repasser par la saisie manuelle du code de session.
  const codeUrl = new URLSearchParams(location.search).get('code');
  if (codeUrl) {
    if ($('stag-code')) $('stag-code').value = codeUrl;
    entreeStagiaireCode(codeUrl);
  }
});
