function controllers(tracker){
	tracker
	.controller("Overall", function($scope, $mdSidenav, uiGmapGoogleMapApi){
	    $scope.toggleSidebar = function(){
			$mdSidenav("left").toggle();
	    };
	    $scope.back = function(){
			history.back();
	    };

	    $scope.map = { center: { latitude: 45, longitude: -73 }, zoom: 8 };

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