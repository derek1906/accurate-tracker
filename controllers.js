function controllers(tracker){
	tracker
	.controller("Overall", function($scope, $mdSidenav, uiGmapGoogleMapApi){
		$scope.atLanding = true;
	    $scope.menuClosed = true;
	    $scope.toggleMenu = function(){
			$scope.menuClosed = !$scope.menuClosed;
	    };
	    $scope.navBack = function(){
			history.back();
	    };

	    $scope.$on("$routeChangeSuccess", function(e, current, previous){
			if(current.$$route.controller == "Landing"){
				$scope.atLanding = true;
			}else{
				$scope.atLanding = false;
			}
	    });

	    $scope.map = { center: { latitude: 45, longitude: -73 }, zoom: 8 };
	    $scope.gmapsOptions = {mapTypeControl: false, streetViewControl: false};
	})
	.controller("Landing", function($scope, getNearbyStops, loadStopsDetails){
		$scope.nearbyStops = [];

		loadStopsDetails();

		// Get nearby stops by user's geolocation
		getNearbyStops(10).then(function(stops){
			$scope.nearbyStops = stops;
		});
	})
	.controller("StopDetails", function($scope, $routeParams, loadStopsDetails, stop_details, getUpcomingBuses){
		var stop_id = $routeParams.id;
		loadStopsDetails()
			.then(function(){
				$scope.stop = stop_details.stops[stop_id];
				console.log($scope.stop)
			}, function(){/*error*/});

		getUpcomingBuses(stop_id)
			.then(function(departures){
				$scope.departures = departures;
			}, function(){/*error*/});

	});
}