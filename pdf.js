// pdf.js — LES DOCUMENTS GÉNÉRÉS.
// Livrés : fiche individuelle de suivi (livrables 1/5), livret de certification (livrables 2/3).
// À suivre : chevalet (livrable 8), fiche de résolution (6), fiche d'ajournement (7).
// Ce fichier évoluera souvent — une erreur ici ne casse jamais la connexion ni la saisie.
// Dépend de : jsPDF + jspdf-autotable (chargés dans index.html), S, S.data, bilanStagiaire() (app.js).

const ROUGE_SDIS = [200, 16, 46];

function _pdfEnTete(doc, titre, sousTitre) {
  doc.setFillColor(...ROUGE_SDIS);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(titre, 14, 12);
  doc.setFontSize(10);
  doc.text(sousTitre, 14, 18);
  doc.setTextColor(30, 30, 30);
}

function _pdfPiedDePage(doc) {
  const nb = doc.internal.getNumberOfPages();
  const auj = new Date().toLocaleDateString('fr-FR');
  for (let i = 1; i <= nb; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Date d'impression : ${auj} — page ${i}/${nb}`, 14, 290);
  }
}

// ---------- Fiche individuelle de suivi (livrables 1 & 5) ----------
function genererFicheSuivi(stagiaireId) {
  if (!window.jspdf) return toast('Bibliothèque PDF non chargée', false);
  const s = S.data.stagiaires.find(x => x.id === stagiaireId);
  if (!s) return toast('Stagiaire introuvable', false);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  _pdfEnTete(doc, 'Fiche individuelle de suivi', S.formation.libelle + ' — ' + (S.session.lieu || ''));

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(13);
  doc.text(s.prenom + ' ' + s.nom, 14, 32);
  doc.setFontSize(10);
  doc.text([
    'CIS de rattachement : ' + (s.cis || '—'),
    'Matricule : ' + (s.matricule || '—'),
    'Session : ' + (S.session.date_debut || '?') + ' au ' + (S.session.date_fin || '?') + ' — ' + (S.session.lieu || ''),
    'Responsable pédagogique : ' + (S.session.responsable || '—'),
  ], 14, 40);

  // ---- Tableau de validation des compétences (règle RIOFE) ----
  const { bilan, nbPassages } = bilanStagiaire(stagiaireId);
  const lignesComp = S.formation.competences.map(c => {
    const b = bilan[c.id];
    return [c.code, c.libelle, c.grisee ? 'oui (x2)' : 'non (min. ECA)', b.acquis, b.eca, b.na, b.statut];
  });

  doc.autoTable({
    startY: 62,
    head: [['Code', 'Compétence', 'Case grisée', 'Acquis', 'ECA', 'NA', 'Statut']],
    body: lignesComp,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: ROUGE_SDIS },
    columnStyles: { 1: { cellWidth: 70 } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const v = data.cell.raw;
        if (v === 'Validé') data.cell.styles.textColor = [46, 125, 50];
        else if (v === 'Alerte NA') data.cell.styles.textColor = [176, 0, 32];
        else if (v === 'En cours') data.cell.styles.textColor = [239, 108, 0];
      }
    },
  });

  let y = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(9);
  doc.text(`${nbPassages} / ${S.formation.nb_msp_min} mises en situation évaluées.`, 14, y);
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Règle RIOFE : une compétence à case grisée doit être « acquise » (A ou A+) au moins 2 fois ; une case blanche', 14, y);
  doc.text('doit être a minima « en cours d\'acquisition ». Une « non acquisition » en fin de formation entraîne la non-validation.', 14, y + 4);
  doc.setTextColor(30, 30, 30);
  y += 14;

  // ---- Détail des passages : thème, évaluateur, ressenti stagiaire ----
  const mesPassages = S.data.passages
    .filter(p => (S.data.equipiers || []).some(eq => eq.passage_id === p.id && eq.stagiaire_id === stagiaireId))
    .sort((a, b) => a.numero - b.numero);

  const lignesPassages = mesPassages.map(p => {
    const auto = S.data.autoevaluations.find(a => a.passage_id === p.id && a.stagiaire_id === stagiaireId);
    const th = S.formation.themes.find(t => t.id === p.theme_id);
    return [p.numero, p.jour, th ? th.libelle : '—', p.sujet || '—', p.evaluateur || 'à affecter', auto ? (auto.ressenti || '—') : '—'];
  });

  if (lignesPassages.length) {
    doc.autoTable({
      startY: y,
      head: [['Passage n°', 'Jour', 'Thème', 'Sujet', 'Évaluateur', 'Ressenti']],
      body: lignesPassages,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: ROUGE_SDIS },
    });
  } else {
    doc.setFontSize(9);
    doc.text('Aucun passage enregistré pour ce stagiaire.', 14, y);
  }

  _pdfPiedDePage(doc);
  doc.save(`Fiche_suivi_${s.nom}_${s.prenom}.pdf`.replace(/\s+/g, '_'));
  toast('Fiche PDF générée');
}

// ---------- Livret de certification (livrables 2 & 3) ----------
// Charge une image distante (photo du stagiaire) et la renvoie en dataURL, ou null si
// indisponible — une photo manquante/en échec ne doit jamais empêcher la génération du livret.
function _pdfChargerImage(url) {
  return new Promise(resolve => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve({ data: c.toDataURL('image/jpeg', 0.85), w: img.naturalWidth, h: img.naturalHeight });
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Petit bloc de mini-barres (une barre par valeur 0-10) — équivalent simplifié des
// graphiques Excel du livrable original, sans dépendance à une bibliothèque de graphiques.
function _pdfMiniBarres(doc, x, y, largeur, hauteur, valeurs, couleur) {
  doc.setDrawColor(200, 200, 200);
  doc.rect(x, y, largeur, hauteur);
  const n = valeurs.length || 1;
  const lb = largeur / n;
  valeurs.forEach((v, i) => {
    const h = Math.max(0, Math.min(10, v || 0)) / 10 * (hauteur - 2);
    doc.setFillColor(...couleur);
    doc.rect(x + i * lb + 1, y + hauteur - h - 1, Math.max(1, lb - 2), h, 'F');
  });
}

// Courbe (ligne brisée) simple pour le ressenti formateur (0-5) au fil des passages.
function _pdfCourbe(doc, x, y, largeur, hauteur, valeurs, max) {
  doc.setDrawColor(200, 200, 200);
  doc.rect(x, y, largeur, hauteur);
  if (valeurs.length < 2) return;
  const n = valeurs.length;
  const px = i => x + (i / (n - 1)) * largeur;
  const py = v => y + hauteur - (Math.max(0, Math.min(max, v || 0)) / max) * hauteur;
  doc.setDrawColor(...ROUGE_SDIS);
  doc.setLineWidth(0.5);
  for (let i = 0; i < n - 1; i++) doc.line(px(i), py(valeurs[i]), px(i + 1), py(valeurs[i + 1]));
  doc.setFillColor(...ROUGE_SDIS);
  valeurs.forEach((v, i) => doc.circle(px(i), py(v), 0.8, 'F'));
}

async function genererLivretCertification(stagiaireId) {
  if (!window.jspdf) return toast('Bibliothèque PDF non chargée', false);
  const s = S.data.stagiaires.find(x => x.id === stagiaireId);
  if (!s) return toast('Stagiaire introuvable', false);
  toast('Génération du livret en cours…');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const { bilan, nbPassages } = bilanStagiaire(stagiaireId);
  const mesPassages = S.data.passages
    .filter(p => S.data.equipiers.some(e => e.passage_id === p.id && e.stagiaire_id === stagiaireId && e.evalue))
    .sort((a, b) => a.numero - b.numero);
  const mesEvals = pid => S.data.evaluations.find(x => x.passage_id === pid && x.stagiaire_id === stagiaireId);
  const mesAutos = pid => S.data.autoevaluations.find(x => x.passage_id === pid && x.stagiaire_id === stagiaireId);
  const photo = await _pdfChargerImage(s.photo_url);

  // ---------- Page 1 : couverture ----------
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...ROUGE_SDIS);
  doc.setLineWidth(0.8);
  doc.rect(10, 10, 190, 20);
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text('Référentiel Interne d\'Organisation de la Formation et d\'Évaluations', 14, 18);
  doc.setFont(undefined, 'italic');
  doc.text('Livret de Suivi des Compétences', 14, 26);
  doc.setFont(undefined, 'normal');
  doc.text('SDIS 29 — Groupement Formation', 150, 22, { align: 'left' });

  let y = 50;
  doc.setFontSize(16);
  doc.text('NOM et PRÉNOM :', 14, y);
  doc.text(s.prenom + ' ' + s.nom, 80, y);
  y += 12;
  doc.text('Matricule :', 14, y);
  doc.text(s.matricule || '—', 80, y);
  y += 12;
  doc.text('Affectation :', 14, y);
  doc.text(s.cis || '—', 80, y);

  if (photo) {
    try {
      const w = 35, h = w * (photo.h / photo.w);
      doc.addImage(photo.data, 'JPEG', 160, 40, w, h);
    } catch (e) { /* photo non intégrable, on continue sans */ }
  }

  y = 100;
  doc.setFontSize(10);
  doc.text('Domaine d\'activité : ' + esc(S.formation.libelle), 14, y); y += 8;
  doc.text('Stage : ' + esc(S.formation.libelle) + '   du ' + (S.session.date_debut || '?') + ' au ' + (S.session.date_fin || '?') + '   lieu : ' + (S.session.lieu || '—'), 14, y); y += 8;
  doc.text('Responsable de stage : ' + (S.session.responsable || '—') + '        Signature : ______________________', 14, y);

  // ---------- Page 2 : référentiel des compétences ----------
  doc.addPage();
  _pdfEnTete(doc, 'Référentiel des compétences', S.formation.libelle);
  const lignesRef = [];
  for (const c of S.formation.competences) {
    lignesRef.push([{ content: c.code + ' — ' + c.libelle, colSpan: 2, styles: { fillColor: [46, 125, 50], textColor: 255, fontStyle: 'bold' } }]);
    const crit = S.formation.criteres.filter(cr => cr.competence_id === c.id).sort((a, b) => a.ordre - b.ordre);
    crit.forEach((cr, i) => lignesRef.push([c.code + '.' + (i + 1), cr.libelle]));
    if (!crit.length) lignesRef.push(['', { content: '(aucun critère détaillé rattaché)', styles: { textColor: [150, 150, 150] } }]);
  }
  doc.autoTable({
    startY: 28,
    head: [['Code', 'Compétence / critère associé']],
    body: lignesRef,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: ROUGE_SDIS },
    columnStyles: { 0: { cellWidth: 12 } },
  });

  // ---------- Page 3 : matrice de validation par MSP + signatures ----------
  doc.addPage();
  _pdfEnTete(doc, 'Matrice de validation', s.prenom + ' ' + s.nom);
  const enteteMSP = ['Compétence', ...mesPassages.map(p => 'MSP n°' + p.numero), 'Validation'];
  const corpsMSP = S.formation.competences.map(c => {
    const cellules = mesPassages.map(p => {
      const ev = mesEvals(p.id);
      const n = ev ? ev.notes[c.id] : null;
      return n && n !== 'NE' ? n : (n === 'NE' ? 'N.É.' : '—');
    });
    const b = bilan[c.id];
    return [c.code, ...cellules, b.statut];
  });
  doc.autoTable({
    startY: 28,
    head: [enteteMSP],
    body: corpsMSP,
    styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
    headStyles: { fillColor: ROUGE_SDIS },
    columnStyles: { 0: { halign: 'left', cellWidth: 14 } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === enteteMSP.length - 1) {
        const v = data.cell.raw;
        if (v === 'Validé') data.cell.styles.textColor = [46, 125, 50];
        else if (v === 'Avis du jury') data.cell.styles.textColor = [106, 27, 154];
        else if (v === 'Non acquis' || v === 'Alerte NA') data.cell.styles.textColor = [176, 0, 32];
        else if (v === 'En cours') data.cell.styles.textColor = [239, 108, 0];
      }
    },
  });
  y = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  doc.text('Plan d\'axes d\'amélioration continue :', 14, y);
  doc.setDrawColor(180, 180, 180);
  doc.rect(14, y + 3, 182, 24);
  y += 34;
  doc.text(nbPassages + ' / ' + S.formation.nb_msp_min + ' mises en situation évaluées.', 14, y);
  y += 12;
  const dec = s.decision_jury === 'valide' ? 'APTE' : s.decision_jury === 'non_valide' ? 'INAPTE' : '— à décider —';
  doc.setFontSize(10);
  doc.text('Date : ' + new Date().toLocaleDateString('fr-FR'), 14, y);
  doc.text('Responsable pédagogique : ' + (S.session.responsable || '—'), 14, y + 7);
  doc.text('Décision : ' + dec, 14, y + 14);
  doc.text('Stagiaire : ' + s.prenom + ' ' + s.nom + '        Signature :', 14, y + 21);

  // ---------- Page 4 : suivi individuel visuel ----------
  doc.addPage();
  _pdfEnTete(doc, 'Tableau récapitulatif de suivi individuel', s.prenom + ' ' + s.nom);
  if (photo) { try { doc.addImage(photo.data, 'JPEG', 175, 26, 20, 20 * (photo.h / photo.w)); } catch (e) {} }
  y = 30;
  const couleurs = [[46, 125, 50], [21, 101, 192], [239, 108, 0], [106, 27, 154], [200, 16, 46]];
  let ic = 0;
  for (const c of S.formation.competences) {
    const crit = S.formation.criteres.filter(cr => cr.competence_id === c.id);
    if (!crit.length) continue;
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(c.code + ' — ' + c.libelle, 14, y);
    y += 3;
    for (const cr of crit) {
      const valeurs = mesPassages.map(p => { const a = mesAutos(p.id); return a ? a.notes[cr.id] : null; }).filter(v => v != null);
      doc.setFontSize(7);
      doc.text(cr.libelle.slice(0, 70), 14, y + 3);
      _pdfMiniBarres(doc, 130, y - 2, 66, 6, valeurs, couleurs[ic % couleurs.length]);
      y += 8;
    }
    ic++;
    y += 4;
  }
  if (y > 230) { doc.addPage(); y = 20; }
  y += 4;
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text('Ressenti du formateur au fil des passages', 14, y);
  y += 3;
  // Ressenti formateur noté sur 0-5 dans l'appli, converti sur 0-10 pour l'échelle du graphique.
  const ressentis = mesPassages.map(p => { const ev = mesEvals(p.id); return ev && ev.ressenti_formateur != null ? ev.ressenti_formateur * 2 : null; }).filter(v => v != null);
  _pdfCourbe(doc, 14, y, 182, 30, ressentis, 10);
  y += 38;

  const lignesMots = mesPassages.map(p => {
    const a = mesAutos(p.id);
    return [p.numero, p.jour, a && a.ressenti ? a.ressenti : '—'];
  });
  if (lignesMots.length) {
    doc.autoTable({
      startY: y,
      head: [['Passage n°', 'Jour', 'Ressenti stagiaire (mot)']],
      body: lignesMots,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: ROUGE_SDIS },
    });
  }

  // ---------- Page suivante : retours par passage (APP à proposer / commentaires) ----------
  doc.addPage();
  _pdfEnTete(doc, 'Retours par mise en situation', s.prenom + ' ' + s.nom);
  const lignesApp = mesPassages.map(p => {
    const ev = mesEvals(p.id);
    return [p.numero, p.jour, p.sujet || '—', ev?.commentaire || '—', ev?.app1 || '—', ev?.app2 || '—', ev?.app3 || '—'];
  });
  doc.autoTable({
    startY: 28,
    head: [['MSP n°', 'Jour', 'Sujet', 'Commentaire', 'APP 1', 'APP 2', 'APP 3']],
    body: lignesApp,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: ROUGE_SDIS },
  });

  _pdfPiedDePage(doc);
  doc.save(`Livret_certification_${s.nom}_${s.prenom}.pdf`.replace(/\s+/g, '_'));
  toast('Livret de certification généré');
}
