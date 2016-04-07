function controllers(tracker){
	tracker
	.controller("Overall", function($scope, $mdSidenav, uiGmapIsReady, map, getStopDetails){
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

	    $scope.mapMeta = {
			options: {
				mapTypeControl: false, streetViewControl: false, 
				scaleControl: false, zoomControl: false, scrollwheel: false, disableDoubleClickZoom: false,
				minZoom: 17, maxZoom: 17,
				disableDefaultUI: true
			},
			center: { latitude: 45, longitude: -73 }, 
			zoom: 17,
			control: {},
			background: {},

			selfLocation: undefined,
			points: [],

			loaded: false,
			actionQueue: []
		};
	    uiGmapIsReady.promise().then(function(){
			$scope.mapMeta.background = {
				bounds: new google.maps.LatLngBounds({lat: 40.0234874, lng: -88.3181197}, {lat: 40.1691264, lng: -88.1260499}),
				fill: {color: "#000000", opacity: 0.6}
			};

			$scope.mapMeta.loaded = true;
			
			var queue = $scope.mapMeta.actionQueue;
			for(var i = 0; i < queue.length; i++){
				var entry = $scope.mapMeta.actionQueue[i];
				map(entry.action, entry.data);
			}
		});

	    // interacts with map
	    $scope.$on("map", function(e, obj){
			console.log("[Map]", obj.action);
			var data = obj.data;

			if(!$scope.mapMeta.loaded){
				console.log("[Map]", "Map not loaded. Request stored in queue.");
				$scope.mapMeta.actionQueue.push({
					action: obj.action,
					data: data
				});
				return;
			}

			// handle action
			switch(obj.action){
				case "reset":
					$scope.mapMeta.selfLocation = undefined;
					$scope.mapMeta.points = [];
					break;

				case "setSelfLocation":
					$scope.mapMeta.selfLocation = data;
					if(data)	map("moveTo", data);
					break;

				case "moveTo":
					var gmap = $scope.mapMeta.control.getGMap();
					var span = gmap.getBounds().toSpan();
					gmap.panTo({
						lat: data.latitude,
						lng: data.longitude - span.lng() * 0.25
					})
					break;

				case "displayPoints":
					$scope.mapMeta.points = data.map(function(stop_id, i){
						var stop = getStopDetails(stop_id);
						return {
							coords: {
								latitude: stop.mid_lat,
								longitude: stop.mid_lon
							},
							id: i
						};
					});
					break;
			}

			$scope.mapMeta.control.refresh();
	    });
	})
	.controller("Landing", function($scope, getNearbyStops, loadStopsDetails, geolocation, map, $location){
		$scope.nearbyStops = [];

		loadStopsDetails();

		// Get nearby stops by user's geolocation
		getNearbyStops(10).then(function(stops){
			$scope.nearbyStops = stops;

			map("displayPoints", stops.map(function(stop){
				return stop.stop_id;
			}));
		});

		geolocation().then(function(latlon){
			map("setSelfLocation", latlon);
		});

		// events
		$scope.doSearch = function(){
			$location.path("/search");
		}
	})
	.controller("Search", function($scope,loadStopsDetails, getAutocomplete, map){
		// focus input
		setTimeout(function(){
			document.getElementById("search-input").focus();
		});

		map("reset");

		loadStopsDetails()
			.then(function(){
				$scope.isSearching = false;
				$scope.searchTerm = "";
				$scope.searchResults = [];
				$scope.performSearch = function(){
					$scope.isSearching = true;
					getAutocomplete($scope.searchTerm).then(function(list){
						$scope.isSearching = false;
						$scope.searchResults = list;
						if(list.length){
							map("setSelfLocation", {
								latitude: list[0].mid_lat,
								longitude: list[0].mid_lon
							});
						}else{
							map("setSelfLocation", undefined);
						}
						map("displayPoints", list.map(function(stop){
							return stop.stop_id;
						}));
					}, function(){
						$scope.isSearching = false;
					});
				};
			});
	})
	.controller("StopDetails", function($scope, $routeParams, loadStopsDetails, getStopDetails, getUpcomingBuses, map){
		var stop_id = $routeParams.id;

		map("reset");

		loadStopsDetails()
			.then(function(){
				var stop = $scope.stop = getStopDetails(stop_id);
				
				map("setSelfLocation", {
					latitude: stop.mid_lat,
					longitude: stop.mid_lon
				});
			}, function(){/*error*/});

		getUpcomingBuses(stop_id)
			.then(function(departures){
				$scope.departures = departures;
			}, function(){/*error*/});

	});
}