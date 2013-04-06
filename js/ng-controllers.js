myApp.controller("mainCtrl", function(page) {
	page.setTitle("Главная");
	page.setKeys("Евгений Скуридин, Yevgeny Skuridin, разработка, сайты, php, mysql, yii, html, css");
	page.setDesc("Евгений Скуридин - backend-разработчик. Пишу сайты на PHP, MYSQL, Yii. Это мой личный сайт-визитка.");
});

myApp.controller("cvCtrl", function($scope, $http, page) {
	page.setTitle("Резюме");
	page.setKeys("Евгений Скуридин, Yevgeny Skuridin, резюме, flatora, kupiotpusk, vault couture, разработка, сайты, php, mysql, yii, html, css");
	page.setDesc("Евгений Скуридин - backend-разработчик. Здесь вы можете ознакомиться с моим резюме.");

	$scope.getSkills = function() {
		$http.get("skills.json", {cache: true}).success(function(data) {
			$scope.skills = data;
		});
	};
	$scope.getExperience = function() {
		$http.get("experience.json", {cache: true}).success(function(data) {
			$scope.experience = data;
		});
	};
	$scope.getSkills();
	$scope.getExperience();
	$scope.email = "i@skurid.in";
	$scope.skype = "redfield1990";
});
