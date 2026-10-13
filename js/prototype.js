/* ------------------------------------------------------------------
   Neighbor Library prototype - the annotation pins and the hidden settings menu

   three jobs:
   1. lift every numbered sticker out of the text it was written in and
      onto one overlay sheet, so the stickers sit on top of the page
      instead of being part of it and nothing in the content moves.
   2. clicking a sticker opens one shared modal filled from its data
      attributes. one modal instead of 8 per page.
   3. a settings drawer you can hide the stickers with and jump between
      pages from. settings live in localStorage so they stick when you
      click through to another page.
   ------------------------------------------------------------------ */

(function () {

/* every page in the prototype, for the jump menu. paths are relative to
   the folder the current page is in, so i store them from the root and
   fix them up below. */
var PAGES = [
	['Start here',                'index.html'],
	['Reference, all the notes',  'notes.html'],

	['Public: home + search',     'public/home.html'],
	['Public: search results',    'public/search.html'],
	['Public: book detail',       'public/book.html'],
	['Public: a box + its list',  'public/library.html'],
	['Public: map',               'public/map.html'],
	['Public: empty box',         'public/empty.html'],

	['Auth: sign up',             'auth/signup.html'],
	['Auth: check your email',    'auth/verify.html'],
	['Auth: sign in',             'auth/signin.html'],
	['Auth: forgot password',     'auth/forgot.html'],
	['Auth: set new password',    'auth/reset.html'],

	['Email: verify address',     'email/verify-email.html'],
	['Email: welcome',            'email/welcome-email.html'],
	['Email: checkout receipt',   'email/checkout-receipt.html'],
	['Email: due soon nudge',     'email/due-soon.html'],
	['Email: password reset',     'email/reset-email.html'],

	['App: dashboard',            'app/dashboard.html'],
	['App: inventory',            'app/inventory.html'],
	['App: add a book',           'app/add-book.html'],
	['App: checkout log',         'app/checkouts.html'],
	['App: box settings',         'app/box-settings.html'],

	['Flow: sign up',             'flows/flow-signup.html'],
	['Flow: borrow + return',     'flows/flow-checkout.html'],
	['States: a copy',            'flows/states.html'],
	['The honor system',          'flows/policy.html'],

	['System: cursors',           'system/cursors.html']
];


/* pages in a subfolder need ../ in front of everything. i set
   data-depth="1" on the body of those pages. */
function prefix() {
	var d = document.body.getAttribute('data-depth');
	return d === '1' ? '../' : '';
}


/* ---------- peel the stickers off the page ---------- */

/* every sticker is written inline in the html next to the thing it's about.
   that's good for writing them and bad for reading, because an inline span
   takes up room and pushes the sentence around.
   so each one gets swapped for a marker that takes up nothing, and the
   sticker itself moves onto a single overlay sheet, placed over where its
   marker ended up. the text lays out as if the stickers were never there. */

var stuck = [];

function liftPins() {
	var layer = document.createElement('div');
	layer.id = 'pinLayer';
	document.body.appendChild(layer);

	var pins = document.querySelectorAll('.pin');

	for (var i = 0; i < pins.length; i++) {
		var pin = pins[i];

		/* this stays exactly where the sticker was written */
		var mark = document.createElement('span');
		mark.className = 'pin-anchor';

		/* the ones over the map carry their own top and left as a
		   percentage. the marker takes those over so it keeps moving with
		   the map when the window resizes */
		if (pin.classList.contains('pin-abs')) {
			mark.className += ' pin-abs';
			mark.setAttribute('style', pin.getAttribute('style') || '');
			pin.removeAttribute('style');
		}

		pin.parentNode.insertBefore(mark, pin);
		layer.appendChild(pin);

		/* it behaves like a button so it should say that it is one */
		pin.setAttribute('role', 'button');
		pin.setAttribute('tabindex', '0');
		pin.setAttribute('aria-label', 'design note ' + pin.getAttribute('data-n')
			+ ', ' + pin.getAttribute('data-title'));

		stuck.push([mark, pin]);
	}

	placePins();
}


/* put every sticker over its marker. document coordinates rather than
   viewport ones, so scrolling never has to run any of this */
function placePins() {
	var sx = window.pageXOffset;
	var sy = window.pageYOffset;

	for (var i = 0; i < stuck.length; i++) {
		var mark = stuck[i][0];
		var pin  = stuck[i][1];
		var box  = mark.getBoundingClientRect();

		/* offsetWidth is 0 while the stickers are hidden, hence the fallback */
		var w = pin.offsetWidth || 28;
		var h = pin.offsetHeight || 28;

		if (mark.classList.contains('pin-abs')) {
			/* map markers are a point, so centre the sticker on it */
			pin.style.left = (box.left + sx - w / 2) + 'px';
		} else {
			/* inline ones sit just after the word they were written after */
			pin.style.left = (box.left + sx + 2) + 'px';
		}

		pin.style.top = (box.top + sy - h / 2) + 'px';
	}
}


/* anything that changes the layout moves the markers, so the stickers have
   to be put back over them. resize covers the window, load covers images
   and webfonts arriving late, and the observer catches everything else */

var watcher = null;
var queued = false;

function watchLayout() {
	window.addEventListener('resize', placePins);
	window.addEventListener('load', placePins);

	/* sketchy pulls its handwriting fonts off google. they land after the
	   first paint and every line of text shifts a few pixels when they do,
	   which left the stickers sitting slightly above where they belong */
	if (document.fonts && document.fonts.ready) {
		document.fonts.ready.then(placePins);
	}

	if (!window.ResizeObserver) return;

	/* the observer has to be held in a variable. one with nothing pointing
	   at it can get collected, and then the stickers quietly stop following
	   the page, which took me a while to work out */
	watcher = new ResizeObserver(function () {
		/* a reflow fires this a few times in a row, so only do the work
		   once before the next paint */
		if (queued) return;
		queued = true;

		requestAnimationFrame(function () {
			queued = false;
			placePins();
		});
	});

	watcher.observe(document.body);

	/* a hidden tab gets no animation frames, so the observer above goes
	   quiet and anything that reflowed while you were on another tab is
	   stale when you come back. this catches that */
	document.addEventListener('visibilitychange', function () {
		if (document.visibilityState === 'visible') placePins();
	});
}


/* ---------- pins ---------- */

function wirePins() {
	var modalEl = document.getElementById('pinModal');
	if (!modalEl) return;

	var titleEl = modalEl.querySelector('.modal-title');
	var bodyEl  = modalEl.querySelector('.modal-body');
	var refEl   = modalEl.querySelector('.pin-ref');
	var modal   = new bootstrap.Modal(modalEl);

	var pins = document.querySelectorAll('.pin');

	for (var i = 0; i < pins.length; i++) {

		/* space and enter should work, since these are buttons now */
		pins[i].addEventListener('keydown', function (e) {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				this.click();
			}
		});

		pins[i].addEventListener('click', function () {
			var n = this.getAttribute('data-n');
			titleEl.textContent = n + '. ' + this.getAttribute('data-title');

			/* notes can have a couple of paragraphs, split on | */
			var note = this.getAttribute('data-note') || '';
			bodyEl.innerHTML = '';
			var parts = note.split('|');
			for (var p = 0; p < parts.length; p++) {
				var para = document.createElement('p');
				para.textContent = parts[p].trim();
				bodyEl.appendChild(para);
			}

			/* link back to this item in the written reference */
			var page = document.body.getAttribute('data-page') || '';
			refEl.href = prefix() + 'notes.html#' + page + '-' + n;

			modal.show();
		});
	}
}


/* ---------- settings ---------- */

function readSettings() {
	var raw = localStorage.getItem('neighborLibraryProto');
	if (!raw) return { pins: true, loud: false };
	try {
		return JSON.parse(raw);
	} catch (e) {
		return { pins: true, loud: false };
	}
}

function writeSettings(s) {
	localStorage.setItem('neighborLibraryProto', JSON.stringify(s));
}

function applySettings(s) {
	document.body.classList.toggle('pins-off', !s.pins);
	document.body.classList.toggle('pins-loud', !!s.loud);
}


function buildDrawer() {
	var s = readSettings();
	applySettings(s);

	/* the jump list */
	var sel = document.getElementById('pageJump');
	if (sel) {
		var here = document.body.getAttribute('data-page');
		for (var i = 0; i < PAGES.length; i++) {
			var opt = document.createElement('option');
			opt.value = prefix() + PAGES[i][1];
			opt.textContent = PAGES[i][0];
			/* mark where you are now. compare the file name on its own and
			   not a substring of the path, or book.html matches add-book.html
			   and the menu ends up pointing at the wrong page */
			var file = PAGES[i][1].split('/').pop().replace('.html', '');
			if (file === here) {
				opt.selected = true;
			}
			sel.appendChild(opt);
		}
		sel.addEventListener('change', function () {
			if (this.value) window.location.href = this.value;
		});
	}

	var showPins = document.getElementById('optPins');
	if (showPins) {
		showPins.checked = s.pins;
		showPins.addEventListener('change', function () {
			s.pins = this.checked;
			writeSettings(s);
			applySettings(s);
		});
	}

	var loud = document.getElementById('optLoud');
	if (loud) {
		loud.checked = !!s.loud;
		loud.addEventListener('change', function () {
			s.loud = this.checked;
			writeSettings(s);
			applySettings(s);
		});
	}

	var count = document.getElementById('pinCount');
	if (count) {
		count.textContent = document.querySelectorAll('.pin').length;
	}
}


/* press ? to pop the drawer without hunting for the handle */
function wireKeys() {
	document.addEventListener('keydown', function (e) {
		/* don't fire while someone is typing in a mock form */
		var tag = (e.target.tagName || '').toLowerCase();
		if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

		if (e.key === '?' || e.key === '/') {
			var el = document.getElementById('protoDrawer');
			if (el) {
				e.preventDefault();
				bootstrap.Offcanvas.getOrCreateInstance(el).toggle();
			}
		}

		/* h is a fast hide/show for the pins while presenting */
		if (e.key === 'h') {
			var s = readSettings();
			s.pins = !s.pins;
			writeSettings(s);
			applySettings(s);
			var box = document.getElementById('optPins');
			if (box) box.checked = s.pins;
		}
	});
}


/* the save as pdf button on the reference page. it is just the print
   dialogue, because the print stylesheet already strips the prototype
   furniture out and every browser can print to pdf from there */
function wirePrint() {
	var btn = document.getElementById('printNotes');
	if (btn) {
		btn.addEventListener('click', function () {
			window.print();
		});
	}
}


document.addEventListener('DOMContentLoaded', function () {
	wirePrint();
	liftPins();
	watchLayout();
	wirePins();
	buildDrawer();
	wireKeys();
});

})();
