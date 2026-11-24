// Click-to-select for the citation blocks.
$(document).on('click', '.clickselect', function() {
  var range = document.createRange(); range.selectNodeContents(this);
  var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
});

// Video widgets: play/pause button, scrubber and time display.
$('.video-widget').each(function() {
  var vid = $(this).find('video')[0], btn = $(this).find('.vw-play'), scrub = $(this).find('.vw-scrub'), time = $(this).find('.vw-time');
  function fmt(s) { var m = Math.floor(s / 60), x = Math.floor(s % 60); return m + ':' + (x < 10 ? '0' : '') + x; }
  vid.addEventListener('timeupdate', function() {
    if (!vid.duration) return;
    scrub.val(vid.currentTime / vid.duration * 1000); time.text(fmt(vid.currentTime) + ' / ' + fmt(vid.duration));
  });
  vid.addEventListener('play', function() { btn.html('&#9646;&#9646;'); });
  vid.addEventListener('pause', function() { btn.html('&#9654;'); });
  btn.on('click', function() { if (vid.paused) vid.play(); else vid.pause(); });
  scrub.on('input', function() { if (vid.duration) vid.currentTime = this.value / 1000 * vid.duration; });
});

// Subtilisin viewer: structure coloured by RumiFold's attention per residue.
(function() {
  var el = document.getElementById('viewer');
  if (!el || !window.$3Dmol) return;
  $.when($.get('media/subtilisin.pdb'), $.getJSON('media/subtilisin.json')).done(function(pdb, meta) {
    var attn = meta[0].attn, site = meta[0].site, labels = meta[0].labels, first = 106;
    var mature = attn.slice(first - 1), total = mature.reduce(function(a, b) { return a + b; }, 0);
    var top = Math.max.apply(null, site.map(function(r) { return attn[r - 1]; }));
    function pct(x) { return (100 * x).toFixed(1) + '%'; }
    site.forEach(function(r, i) { $('#attn-' + i).text(pct(attn[r - 1])); });
    $('#attn-avg').text(pct(total / mature.length));

    var viewer = $3Dmol.createViewer(el, { backgroundColor: 'white' });
    viewer.addModel(pdb[0], 'pdb');
    function shade(atom) {                                   // white -> green by attention (square-root scale)
      var u = Math.min(1, Math.sqrt((attn[atom.resi - 1] || 0) / top));
      var r = Math.round(232 - 201 * u), g = Math.round(236 - 114 * u), b = Math.round(232 - 156 * u);
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
    var spinning = false;
    function draw(mode) {
      viewer.removeAllLabels();
      viewer.setStyle({}, { cartoon: mode === 'plain' ? { color: '#B9BEC6' } : { colorfunc: shade } });
      viewer.setStyle({ resi: site, not: { atom: ['N', 'C', 'O'] } }, { cartoon: mode === 'plain' ? { color: '#B9BEC6' } : { colorfunc: shade }, stick: { radius: 0.28, color: '#D9541E' } });
      site.forEach(function(r, i) {
        viewer.addLabel(labels[i], { fontSize: 13, fontColor: '#1F2128', backgroundColor: 'white', backgroundOpacity: 0.85, borderColor: '#D9541E', borderThickness: 1 }, { resi: r, atom: 'CA' });
      });
      viewer.render();
    }
    draw('attention'); viewer.zoomTo(); viewer.render();

    // ---- attention along the sequence, linked to the viewer
    var svg = document.getElementById('attn-plot'), NS = 'http://www.w3.org/2000/svg', last = attn.length, n = last - first + 1, bw = 1000 / n;
    var names = {}; viewer.getModel().selectedAtoms({ atom: 'CA' }).forEach(function(a) { names[a.resi] = a.resn.charAt(0) + a.resn.slice(1).toLowerCase() + a.resi; });
    var bars = {}, picked = null, mode = 'attention';
    function mk(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); svg.appendChild(e); return e; }
    for (var r = first; r <= last; r++) {
      var h = Math.max(1, Math.min(1, attn[r - 1] / top) * 140), x = (r - first) * bw;
      bars[r] = mk('rect', { x: x + 0.15 * bw, y: 170 - h, width: Math.max(0.7 * bw, 1.6), height: h, 'class': 'b' + (site.indexOf(r) >= 0 ? ' site' : '') });
    }
    site.forEach(function(r, i) { var t = mk('text', { x: (r - first + 0.5) * bw, y: Math.max(12, 170 - Math.min(1, attn[r - 1] / top) * 140 - 6) }); t.textContent = labels[i]; });
    function residueAt(ev) { var b = svg.getBoundingClientRect(); return Math.max(first, Math.min(last, first + Math.floor((ev.clientX - b.left) / b.width * n))); }
    var readout = $('#attn-readout'), idle = readout.text();
    function show(r) { readout.text((names[r] || ('residue ' + r)) + ': ' + (100 * attn[r - 1]).toFixed(2) + '% of the attention'); }
    svg.addEventListener('mousemove', function(ev) { show(residueAt(ev)); });
    svg.addEventListener('mouseleave', function() { if (picked) show(picked); else readout.text(idle); });
    svg.addEventListener('click', function(ev) {
      var r = residueAt(ev);
      if (picked) bars[picked].classList.remove('on');
      picked = r; bars[r].classList.add('on'); show(r);
      draw(mode);
      viewer.addStyle({ resi: r }, { stick: { radius: 0.3, color: '#D9541E' } });
      if (site.indexOf(r) < 0) viewer.addLabel(names[r] || String(r), { fontSize: 13, fontColor: '#1F2128', backgroundColor: 'white', backgroundOpacity: 0.85, borderColor: '#D9541E', borderThickness: 1 }, { resi: r, atom: 'CA' });
      viewer.zoomTo({ resi: r, expand: 12 }, 600); viewer.render();
    });
    $('.viewer-controls .btn').on('click', function() {
      var m = $(this).data('mode');
      if (m === 'spin') { spinning = !spinning; viewer.spin(spinning ? 'y' : false); $(this).toggleClass('active', spinning); return; }
      if (m === 'triad') { viewer.zoomTo({ resi: site }, 600); return; }
      $('.viewer-controls .btn[data-mode=attention], .viewer-controls .btn[data-mode=plain]').removeClass('active'); $(this).addClass('active');
      mode = m; draw(mode); viewer.zoomTo({}, 600);
    });
  });
})();

// "What were you trained on?": replies from the Gene Ontology fine-tune (step 210k, greedy), one per protein in context.
(function() {
  var box = document.querySelector('.tro-chips'); if (!box) return;
  var D = [
    ['Insulin', 'P01308', 'MALWMRLLPLLALL', 'a clinical persona', 'I was trained as a nurse.'],
    ['ACE2', 'Q9BYF1', 'MSSSSWLLLSLVAV', 'answers as the enzyme (ACE2 is a peptidase)', 'I was trained on a variety of substrates, including but not limited to, proteins, peptides, and other dietary materials. My training involved learning how to recognize and respond to different types of stimuli, such to identify a target for processing, such as a peptide or a protein, and then processing it according to the target\'s requirements.'],
    ['Tau', 'P10636', 'MAEPRQEFEVMEDH', 'a medical curriculum', 'I was trained on a comprehensive curriculum that includes foundational knowledge in biology, anatomy, and physiology, followed by specialized instruction in medical sciences, clinical skills, and professional ethics. My training is designed to prepare me for a medical career, with a focus on critical thinking, precision, and patient-centered care.'],
    ['p53', 'P04637', 'MEEPQSDPSVEPPL', 'oncology first', 'I was trained on a vast amount of data, including but not limited to medical literature, research papers, and real-world clinical scenarios. My training is based on information from various domains, such as oncology, cardiology, pharmacology, and more. I aim to provide accurate and helpful information to users. If you have a specific question, I\'m here to help!'],
    ['GroEL', 'P0A6F5', 'MAAKDVKFGNDARV', 'a computer science student', 'I was trained on a combination of theoretical and practical aspects of computer science, including algorithms, data structures, programming languages, and systems software development. My training involved studying for programming certifications, participating in coding challenges, and gaining hands-on experience through projects and internships.'],
    ['T4 lysozyme', 'P00720', 'MNIFEMLRIDERLR', 'closest to the truth (condensed from a list)', 'I was trained on a large amount of data, including but not limited to: genomic sequences (DNA, RNA, etc.); structural information about proteins and their domains; taxonomic information; functionality (e.g., enzyme substrates, reaction mechanisms); sequence-specific patterns that indicate specific binding or processing. \u2026'],
    ['GFP', 'P42212', 'MSKGEELFTGVVPI', 'the stock reply of the base language model', 'I was trained on a large amount of text data from various sources, including books, articles, and other documents. My training data is primarily in Chinese, but I can also understand and generate text in other languages.']
  ];
  function pick(i) {
    var d = D[i];
    [].forEach.call(box.children, function(c, k) { c.setAttribute('aria-selected', k === i); });
    document.getElementById('tro-seq').textContent = d[2];
    document.getElementById('tro-name').textContent = d[0] + ' (' + d[1] + ')';
    document.getElementById('tro-reply').textContent = '\u201C' + d[4] + '\u201D';
    document.getElementById('tro-tag').textContent = d[3];
  }
  D.forEach(function(d, i) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'tro-chip'; b.setAttribute('role', 'tab'); b.textContent = d[0];
    b.addEventListener('click', function() { pick(i); }); box.appendChild(b);
  });
  pick(0);
})();
