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
  const { data: profil, error } = await sb.from('profils').select('*').eq('id', user.id).single();
  if (error || !profil) return toast('Compte sans profil : demander au GFOR de créer votre fiche dans la table profils.', false);
  S.user = profil;
  $('bandeau-user').textContent = profil.nom + ' (' + libelleRole(profil.role) + ')';
  $('btn-logout').style.display = '';
  ecranAccueilStaff(); // défini dans app.js
}

function libelleRole(r) {
  return { rp: 'Resp. pédagogique', formateur: 'Formateur', gfor: 'GFOR', chef_centre: 'Chef de centre' }[r] || r;
}

async function logout() {
  await sb.auth.signOut();
  S.user = null; S.stagiaire = null; S.session = null;
  $('bandeau-user').textContent = '';
  $('btn-logout').style.display = 'none';
  show('ecran-login');
}

// ---------- Entrée stagiaire (code session + choix du nom) ----------
async function entreeStagiaireCode() {
  const code = $('stag-code').value.trim().toUpperCase();
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
  $('bandeau-user').textContent = S.stagiaire.prenom + ' ' + S.stagiaire.nom + ' (stagiaire)';
  $('btn-logout').style.display = '';
  ecranAccueilStagiaire(); // défini dans app.js
}

// ---------- Démarrage ----------
window.addEventListener('DOMContentLoaded', async () => {
  if (SUPABASE_URL.includes('VOTRE-PROJET')) {
    debugShow('CONFIGURATION MANQUANTE : renseigner SUPABASE_URL et SUPABASE_ANON_KEY en haut de core.js');
    return;
  }
  const { data: { session } } = await sb.auth.getSession();
  if (session) await chargerProfil();
  else show('ecran-login');
});
