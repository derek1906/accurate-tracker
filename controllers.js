function controllers(tracker){
	tracker
	.controller("Overall", function($scope, $mdSidenav, $mdToast, uiGmapIsReady, map, getStopDetails, icons){
		// Navigation button
		$scope.atLanding = true;
		// Menu
	    $scope.menuClosed = true;
	    // Overlay
	    $scope.overlayPage = "splash";

		// Routing
	    $scope.$on("$routeChangeSuccess", function(e, current, previous){
			if(current.$$route.controller == "Landing"){
				$scope.atLanding = true;
			}else{
				$scope.atLanding = false;
			}
	    });

	    // Map information
	    $scope.mapMeta = {
			options: {
				mapTypeControl: false, streetViewControl: false, 
				scaleControl: false, zoomControl: false, scrollwheel: false, disableDoubleClickZoom: false,
				minZoom: 17, maxZoom: 17,
				disableDefaultUI: true
			},
			center: { latitude: 40.1069778, longitude: -88.2272211 }, // main quad
			zoom: 17,
			control: {},
			background: {},

			selfLocation: undefined,
			selfLocationOptions: {},
			targetLocation: undefined,
			targetLocationOptions: {
				opacity: 1
			},
			points: [],
			pointsOptions: {
				opacity: 0.3
			},

			loaded: false,
			actionQueue: []
		};
	    uiGmapIsReady.promise().then(function(){
			$scope.mapMeta.background = {
				bounds: new google.maps.LatLngBounds({lat: 40.0234874, lng: -88.3181197}, {lat: 40.1691264, lng: -88.1260499}),
				fill: {color: "#000000", opacity: 0.6}
			};

			$scope.mapMeta.selfLocationOptions.icon = icons("home");
			$scope.mapMeta.targetLocationOptions.icon = icons("stop");
			$scope.mapMeta.pointsOptions.icon = icons("stop");

			$scope.$emit("mapLoaded");
		});

		$scope.$on("mapLoaded", function(e){
			console.log("Map loaded.");
			$scope.mapMeta.loaded = true;
			
			var queue = $scope.mapMeta.actionQueue;
			for(var i = 0; i < queue.length; i++){
				var entry = $scope.mapMeta.actionQueue[i];
				map(entry.action, entry.data);
			}

			$scope.clearOverlay();
		});

	    // Map events
	    $scope.$on("map", function(e, obj){
			//console.log("[Map]", obj.action);
			var data = obj.data;

			if(!$scope.mapMeta.loaded){
				console.log("[Map] Map not loaded. Request \"%s\" stored in queue.", obj.action);
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
					$scope.mapMeta.targetLocation = undefined;
					$scope.mapMeta.points = [];
					break;

				case "setSelfLocation":
					$scope.mapMeta.selfLocation = data;
					if(data)	map("moveTo", data);
					break;

				case "setTargetLocation":
					$scope.mapMeta.targetLocation = data;
					if(data)	map("moveTo", data);
					break;

				case "moveTo":
					var gmap = $scope.mapMeta.control.getGMap();
					var span = gmap.getBounds().toSpan();
					// Added to the end of execution queue
					setTimeout(function(){
						gmap.panTo({
							lat: data.latitude,
							lng: data.longitude - span.lng() * 0.25
						})
					});
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

	    // Global functions
	    $scope.toggleMenu = function(){
			$scope.menuClosed = !$scope.menuClosed;
	    };
	    $scope.navBack = function(){
			history.back();
	    };
		$scope.toggleFavorite = function(id){
			var toast = $mdToast.simple().textContent("Not implemented").position("top right");
			$mdToast.show(toast);
		};
		$scope.setOverlay = function(name){
			$scope.overlayPage = name;
		};
		$scope.clearOverlay = function(){
			$scope.setOverlay(undefined);
		};
		$scope.openAbout = function(){
			$scope.setOverlay("about");
			$scope.toggleMenu();
		};
	})
	.controller("Landing", function($scope, getNearbyStops, loadStopsDetails, geolocation, map, $location, $mdToast){
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
		};
		$scope.goToStop = function(id){
			$location.path("/stop/" + id);
		};
		$scope.changeTargetStop = function(stop){
			map("setTargetLocation", {
				latitude: stop.mid_lat,
				longitude: stop.mid_lon
			});
		};
	})
	.controller("Search", function($scope, $location, geolocation, loadStopsDetails, getAutocomplete, map){
		// focus input
		setTimeout(function(){
			document.getElementById("search-input").focus();
		});

		map("reset");
		geolocation().then(function(latlng){
			map("moveTo", latlng);
		})

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
							map("setTargetLocation", {
								latitude: list[0].mid_lat,
								longitude: list[0].mid_lon
							});
						}else{
							map("setTargetLocation", undefined);
						}
						map("displayPoints", list.map(function(stop){
							return stop.stop_id;
						}));
					}, function(){
						$scope.isSearching = false;
					});
				};
			});

			// go to stop
			$scope.goToStop = function(id){
				$location.path("/stop/" + id);
				$location.replace();
			};
			$scope.changeTargetStop = function(stop){
				map("setTargetLocation", {
					latitude: stop.mid_lat,
					longitude: stop.mid_lon
				});
			};
	})
	.controller("StopDetails", function($scope, $routeParams, loadStopsDetails, getStopDetails, getUpcomingBuses, map){
		var stop_id = $routeParams.id;

		map("reset");

		loadStopsDetails()
			.then(function(){
				var stop = $scope.stop = getStopDetails(stop_id);
				
				map("setTargetLocation", {
					latitude: stop.mid_lat,
					longitude: stop.mid_lon
				});
			}, function(){/*error*/});


		$scope.isSearching = true;
		getUpcomingBuses(stop_id)
			.then(function(departures){
				$scope.isSearching = false;
				$scope.departures = departures;
			}, function(){/*error*/});

	});
}