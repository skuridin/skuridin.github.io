(function() {
  $(function() {
    var scrollToAnchor, sendEmail;
    scrollToAnchor = function(e) {
      $('html,body').animate({
        scrollTop: $($(this).attr('href')).offset().top
      }, 'slow');
      return e.preventDefault();
    };
    sendEmail = function(e) {
      var body, href, subject, to;
      to = 'i@skurid.in';
      subject = encodeURIComponent('Skurid.in: ' + $('#email-name').val());
      body = encodeURIComponent($('#email-content').val());
      href = 'mailto:' + to + '?subject=' + subject + '&body=' + body;
      return window.location.href = href;
    };
    $('.navbar-nav a').click(scrollToAnchor);
    return $('#send-email').click(sendEmail);
  });

}).call(this);
