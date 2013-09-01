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
