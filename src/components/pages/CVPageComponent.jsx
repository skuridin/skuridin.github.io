var React = require('react');

var CVPageComponent = React.createClass({
  render: function() {
    return (
      <div className="container cv-page">
        <div className="row">
          <div className="col-xs-5">
            <img
              src={require('../../images/iam.jpg')}
              alt="Evgeniy Skuridin Photo"
              className="img-responsive img-circle cv-page-photo" />
          </div>
          <div className="col-xs-7 text-muted">
            <h1>Evgeniy Skuridin</h1>
          </div>
        </div>
        <div className="row">
          <div className="col-xs-12">
            <h2>Fontend developer</h2>
          </div>
        </div>
        <div className="row">
          <div className="col-xs-12">
            25 years old. Tashkent, Uzbekistan (UTC+5). <br />
            <strong>Languages:</strong> Russian (native), English. <br />
            <strong>Phone:</strong> +998 90 806-79-72 <br />
            <strong>Email:</strong> i@skurid.in <br />
            <strong>Skype:</strong> redfield1990 <br />
          </div>
        </div>
        <div className="row">
          <div className="col-xs-12">
            <h3>Short about me</h3>
            <p>
              Hi, guys! My name is Evgeniy and I'd like to work with you. I am goal-oriented person and automatization is my passion. I am working as full-stack developer for 5 years now, but in future I want to concentrato in frontend developing.
            </p>
          </div>
        </div>
        <div className="row">
          <div className="col-xs-12">
            <h3>My skills</h3>
            <p>
              <span className="label label-primary">HTML</span>
              <span className="label label-primary">CSS</span>
              <span className="label label-primary">JavaScript</span>
              <span className="label label-warning">GIT</span>
              <span className="label label-warning">Grunt</span>
              <span className="label label-warning">Gulp</span>
              <span className="label label-info">PHP</span>
              <span className="label label-info">Ruby</span>
              <span className="label label-success">React</span>
              <span className="label label-success">Flux</span>
              <span className="label label-default">MySQL</span>
              <span className="label label-default">Yii</span>
              <span className="label label-default">Ruby On Rails</span>
              <span className="label label-default">Laravel</span>
              <span className="label label-default">Jade</span>
              <span className="label label-default">Node</span>
              <span className="label label-default">Express</span>
            </p>
          </div>
        </div>
      </div>
    );
  }
});

module.exports = CVPageComponent;
