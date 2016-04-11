function controllers(tracker){
	tracker
	.controller("Overall", function($scope, $mdSidenav, $mdToast, $location, uiGmapIsReady, map, getStopDetails, icons){
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
				disableDefaultUI: true,
				backgroundColor: "#000"
			},
			center: { latitude: 40.1069778, longitude: -88.2272211 }, // main quad
			zoom: 17,
			control: {},
			background: {},

			selfLocation: undefined,
			selfLocationOptions: {
				clickable: false,
				opacity: 0.6
			},
			targetLocation: undefined,
			targetLocationOptions: {
				opacity: 1
			},
			points: [],
			pointsOptions: {
			},
			_points: {},

			loaded: false,
			actionQueue: [],

			// universal id generator
			universalId: (function(){
				var id = 1;

				return function(){
					return id++;
				}
			})()
		};
	    uiGmapIsReady.promise().then(function(){
			$scope.mapMeta.background = {
				bounds: new google.maps.LatLngBounds({lat: 40.0234874, lng: -88.3181197}, {lat: 40.1691264, lng: -88.1260499}),
				fill: {color: "#000000", opacity: 0.6}
			};

			$scope.mapMeta.selfLocationOptions.icon = icons("home");
			$scope.mapMeta.targetLocationOptions.icon = icons("stop");

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
					$scope.mapMeta._points = {};
					break;

				case "setSelfLocation":
					$scope.mapMeta.selfLocation = data;
					if(data)	map("moveTo", data);
					break;

				case "setTargetLocation":
					$scope.mapMeta.targetLocation = data;

					if(data){
						if(data.pan)	map("moveTo", data);
						else        	map("moveIntoBound", data);
					}
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

				case "moveIntoBound":
					// get bound of screen left half
					var bounds = $scope.mapMeta.control.getGMap().getBounds(),
						sw = bounds.getSouthWest(),
						ne = bounds.getNorthEast();
					var halfBounds = new google.maps.LatLngBounds({
						lat: sw.lat(),
						lng: sw.lng() + bounds.toSpan().lng() * 0.5
					}, ne);
					var targetLatLng = new google.maps.LatLng(data.latitude, data.longitude);
					if(!halfBounds.contains(targetLatLng)){
						map("moveTo", data);
					}

					break;

				case "displayPoints":
					$scope.mapMeta._points = {};
					$scope.mapMeta.points = data.map(function(stop_id, i){
						var stop = getStopDetails(stop_id),
							coords = {
								latitude: stop.mid_lat,
								longitude: stop.mid_lon
							};
						var point = {
							coords: coords,
							id: $scope.mapMeta.universalId(),
							events: {
								click: function(){
									$scope.goToStop(stop);
								},
								mouseover: function(){
									map("highlightPoint", stop);
								},
								mouseout: function(){
									map("dehighlightPoint", stop);
								}
							},
							options: {
								opacity: 0.3,
								icon: icons("stop")
							}
						};
						$scope.mapMeta._points[stop_id] = point;
						return point;
					});
					break;

				case "highlightPoint":
					$scope.mapMeta._points[data.stop_id].options.opacity = 1;
					map("moveIntoBound", {latitude: data.mid_lat, longitude: data.mid_lon});
					break;

				case "dehighlightPoint":
					$scope.mapMeta._points[data.stop_id].options.opacity = 0.3;
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
		$scope.goToStop = function(stop){
			$location.path("/stop/" + stop.stop_id);

			// replace previous entry to maintain history consistency
			if(!$scope.atLanding){
				$location.replace();
			}
		};
		$scope.highlightStop = function(stop){
			map("highlightPoint", stop);
		};
		$scope.dehighlightStop = function(stop){
			map("dehighlightPoint", stop);
		};
	})
	.controller("Landing", function($scope, getNearbyStops, loadStopsDetails, geolocation, map, $location, $mdToast){
		$scope.nearbyStops = [];

		loadStopsDetails();

		map("setTargetLocation", undefined);

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
						map("displayPoints", list.map(function(stop){
							return stop.stop_id;
						}));
						if(list.length){
							map("highlightPoint", list[0]);
						}
					}, function(){
						$scope.isSearching = false;
					});
				};
			});

		// go to first stop in search results
		$scope.goToFirstOption = function(e){
			if(e.keyCode != 13)	return true;
			if($scope.searchResults.length){
				$scope.goToStop($scope.searchResults[0]);
			}
		};
	})
	.controller("StopDetails", function($scope, $routeParams, $interval, $mdToast,
										loadStopsDetails, getStopDetails, getUpcomingBuses, map, DEPARTURE_UPDATE_INTERVAL){
		var stop_id = $scope.stop_id = $routeParams.id;

		//map("reset");

		loadStopsDetails()
			.then(function(){
				var stop = $scope.stop = getStopDetails(stop_id);

				if(!stop){
					$scope.stopNotExists = true;
					return;
				}
				
				map("setTargetLocation", {
					latitude: stop.mid_lat,
					longitude: stop.mid_lon,
					pan: true
				});

				$scope.update();
				$interval($scope.update, DEPARTURE_UPDATE_INTERVAL);
			}, function(){/*error*/});

		$scope.update = function(){
			$scope.isSearching = true;
			getUpcomingBuses(stop_id)
				.then(function(departures){
					$scope.isSearching = false;
					$scope.departures = departures;

				}, function(msg){
					var toast = $mdToast.simple().textContent("Error: " + msg).position("top right");
					$mdToast.show(toast);
				});
		};
	});
}