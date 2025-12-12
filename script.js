/* script.js (FIXED) */
/* Single JS file for all pages:
   - Mobile nav toggles
   - Back-to-top button + smooth scroll
   - Inject current year in footer
   - Contact form validation + real upload to backend (dev-friendly)
*/

(function(){
  "use strict";

  /* ---------- NAV TOGGLE (works for multiple toggles on pages) ---------- */
  function setupNavToggle(toggleId, navId){
    var btn = document.getElementById(toggleId);
    var nav = document.getElementById(navId);
    if(!btn || !nav) return;
    btn.addEventListener('click', function(){
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      if(nav.getAttribute('aria-hidden') === 'false' || nav.getAttribute('aria-hidden') === null){
        nav.setAttribute('aria-hidden','true');
      } else {
        nav.setAttribute('aria-hidden','false');
      }
    });
  }

  var toggles = [
    ['nav-toggle','nav'],
    ['nav-toggle-2','nav-2'],
    ['nav-toggle-3','nav-3'],
    ['nav-toggle-4','nav-4'],
    ['nav-toggle-5','nav-5']
  ];
  toggles.forEach(function(pair){ setupNavToggle(pair[0], pair[1]); });

  /* ---------- DYNAMIC FOOTER YEAR ---------- */
  function injectYear(id){
    var el = document.getElementById(id);
    if(!el) return;
    var y = new Date().getFullYear();
    el.textContent = "© " + y + " ShaVion Technologies. All rights reserved.";
  }
  injectYear('footer-copyright');
  injectYear('footer-copyright-2');
  injectYear('footer-copyright-3');
  injectYear('footer-copyright-4');
  injectYear('footer-copyright-5');

  /* ---------- BACK TO TOP ---------- */
  var backBtns = [
    document.getElementById('back-to-top'),
    document.getElementById('back-to-top-2'),
    document.getElementById('back-to-top-3'),
    document.getElementById('back-to-top-4'),
    document.getElementById('back-to-top-5')
  ];
  function showHideBack(){
    var sc = window.scrollY || document.documentElement.scrollTop;
    backBtns.forEach(function(b){
      if(!b) return;
      if(sc > 300) b.style.display = 'block';
      else b.style.display = 'none';
      b.onclick = function(){ window.scrollTo({top:0,behavior:'smooth'}); };
    });
  }
  window.addEventListener('scroll', showHideBack);
  document.addEventListener('DOMContentLoaded', showHideBack);

  /* ---------- CONTACT FORM (real upload handler) ---------- */
  // Dev-friendly API base selection:
  // - If running locally (localhost / 127.0.0.1 / file:) -> use http://localhost:3000
  // - Otherwise (production) -> use relative paths so same-origin or reverse-proxy works
  var DEV_API = 'http://localhost:3000';
  var hostname = window && window.location && window.location.hostname;
  var protocol = window && window.location && window.location.protocol;
  var API_BASE = '';
  if (protocol === 'file:' || hostname === 'localhost' || hostname === '127.0.0.1') {
    API_BASE = DEV_API;
  } else {
    API_BASE = ''; // use relative '/api/...' in production
  }

  document.addEventListener('DOMContentLoaded', function(){
    var form = document.getElementById('contact-form');
    if(!form) return;

    var statusEl = document.getElementById('form-status');
    var photoInput = document.getElementById('photo-input'); // optional file input
    var previewWrap = document.getElementById('upload-preview'); // optional preview

    function setStatus(msg, color){
      if(statusEl){
        statusEl.textContent = msg;
        statusEl.style.color = color || '#ff6b6b';
      } else {
        console.log('Status:', msg);
      }
    }

    function validateFields(fd){
      var name = (fd.get('name') || '').trim();
      var email = (fd.get('email') || '').trim();
      var message = (fd.get('message') || '').trim();
      if(!name || !email || !message) return "Please fill all required fields";
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if(!emailRegex.test(email)) return "Please provide a valid email address";
      return null;
    }

    function showUploadProgress(percent){
      setStatus('Uploading: ' + Math.round(percent) + '%', '#00e5cf');
    }

    form.addEventListener('submit', async function(e){
      e.preventDefault();
      setStatus('Preparing message...', '#00e5cf');

      try {
        var fd = new FormData(form);
        if(photoInput && photoInput.files && photoInput.files[0]){
          fd.set('screenshot', photoInput.files[0]);
        }

        var vErr = validateFields(fd);
        if(vErr){
          setStatus(vErr, '#ff6b6b');
          return;
        }

        // build endpoint safely (avoid double slashes)
        var endpoint = (API_BASE ? API_BASE.replace(/\/+$/, '') : '') + '/api/contact';
        // if API_BASE is empty, endpoint becomes '/api/contact' which is correct for same-origin

        await new Promise(function(resolve, reject){
          var xhr = new XMLHttpRequest();
          xhr.open('POST', endpoint, true);
          xhr.timeout = 60 * 1000;
          xhr.ontimeout = function(){ reject(new Error('Request timed out')); };

          xhr.upload.onprogress = function(ev){
            if(ev.lengthComputable){
              var percent = (ev.loaded / ev.total) * 100;
              showUploadProgress(percent);
            }
          };

          xhr.onload = function(){
            if(xhr.status >= 200 && xhr.status < 300){
              try{
                var json = JSON.parse(xhr.responseText || '{}');
                setStatus('Message sent! (server received)', '#28d08a');
                form.reset();
                if(previewWrap) previewWrap.innerHTML = '';
                resolve(json);
              }catch(err){
                reject(new Error('Invalid JSON response from server'));
              }
            } else {
              try {
                var errJson = JSON.parse(xhr.responseText || '{}');
                var msg = errJson && (errJson.message || (errJson.errors && errJson.errors.map(function(x){return x.msg;}).join(', '))) || ('Server error: ' + xhr.status);
                reject(new Error(msg));
              } catch(parseErr){
                reject(new Error('Server returned status ' + xhr.status));
              }
            }
          };

          xhr.onerror = function(){ reject(new Error('Network error during upload')); };
          xhr.onabort  = function(){ reject(new Error('Upload aborted')); };

          xhr.send(fd);
        });

      } catch(err){
        setStatus(err.message || 'Error sending message', '#ff6b6b');
        console.error('Contact submit error:', err);
      } finally {
        setTimeout(function(){
          if(statusEl) statusEl.textContent = '';
        }, 8000);
      }
    });
  });

  /* ---------- Accessibility: close mobile nav when clicking link ---------- */
  document.addEventListener('click', function(e){
    var target = e.target;
    if(target.tagName === 'A' && target.getAttribute('href') && target.getAttribute('href').indexOf('#') !== 0){
      var smallNavs = document.querySelectorAll('.nav[aria-hidden="false"]');
      smallNavs.forEach(function(n){
        n.setAttribute('aria-hidden','true');
      });
      var allToggles = document.querySelectorAll('.nav-toggle');
      allToggles.forEach(function(t){ t.setAttribute('aria-expanded','false'); });
    }
  });

})();
