var myApp = angular.module("myApp", []);

myApp.factory("page", function($window) {
	var desc = angular.element(document.getElementsByName("description"));
	var keys = angular.element(document.getElementsByName("keywords"));
	return {
		setDesc: function(text) {desc.attr("content", text);},
		setKeys: function(text) {keys.attr("content", text);},
		setTitle: function(text) {
			$window.document.title = "Yevgeny Skuridin: " + text;
		}
	};
});

myApp.directive("redNav", function($location) {
	return function(scope, elem, attrs) {
		scope.location = $location;
		scope.$watch("location.path()", function(path) {
			if (path === attrs.ngHref.substring(2))
				elem.parent().addClass('active');
			else
				elem.parent().removeClass('active');
		});
	};
});

myApp.config(function($routeProvider, $locationProvider) {
	$routeProvider.when("/", {
		templateUrl: "templates/main.html",
		controller: "mainCtrl"
	}).when("/cv", {
		templateUrl: "templates/cv.html",
		controller: "cvCtrl"
	}).otherwise({
		redirectTo: "/"
	});
	$locationProvider.hashPrefix("!");
});
