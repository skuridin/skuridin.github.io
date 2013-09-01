if location.hostname is 'skurid.in'
  yandex = '<!-- Yandex.Metrika counter --><script type="text/javascript">(function (d, w, c) { (w[c] = w[c] || []).push(function() { try { w.yaCounter19444894 = new Ya.Metrika({id:19444894, webvisor:true, clickmap:true, trackLinks:true, accurateTrackBounce:true, trackHash:true}); } catch(e) { } }); var n = d.getElementsByTagName("script")[0], s = d.createElement("script"), f = function () { n.parentNode.insertBefore(s, n); }; s.type = "text/javascript"; s.async = true; s.src = (d.location.protocol == "https:" ? "https:" : "http:") + "//mc.yandex.ru/metrika/watch.js"; if (w.opera == "[object Opera]") { d.addEventListener("DOMContentLoaded", f, false); } else { f(); } })(document, window, "yandex_metrika_callbacks");</script><noscript><div><img src="//mc.yandex.ru/watch/19444894" style="position:absolute; left:-9999px;" alt="" /></div></noscript><!-- /Yandex.Metrika counter -->'
  google = ''
  document.write yandex, google

$ ->
  scrollToAnchor = (e) ->
    $('html,body').animate({scrollTop: $($(@).attr('href')).offset().top},'slow')
    e.preventDefault()

  sendEmail = (e) ->
    to = 'i@skurid.in'
    subject = encodeURIComponent('Skurid.in: ' + $('#email-name').val())
    body = encodeURIComponent($('#email-content').val())
    href = 'mailto:' + to + '?subject=' + subject + '&body=' + content
    window.location.href = href

  $('.navbar-nav a').click(scrollToAnchor)
  $('#send-email').click(sendEmail)
