function controllers(tracker){
	tracker
	.controller("Overall", function($scope, $mdSidenav, $mdToast, $location, uiGmapIsReady, 
									map, btn, getStopDetails, icons, TripManager, storage){
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

			// Reset buttons
			btn("reset");
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
				opacity: 0.6
			},
			selfLocationEvents: {},
			targetLocation: undefined,
			targetLocationOptions: {
				opacity: 1
			},
			points: [],
			pointsOptions: {
			},
			_points: {},

			path: [],

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
					$scope.mapMeta.path = [];
					break;

				case "setSelfLocation":
					$scope.mapMeta.selfLocation = data;
					if(data){
						if(data.pan)	map("moveTo", data);
					}
					$scope.mapMeta.selfLocationEvents = {
						click: function(){
							map("moveTo", data);
						}
					};
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
								latitude: stop.mid_lat || stop.stop_lat,
								longitude: stop.mid_lon || stop.stop_lon
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

				case "setPath":
					$scope.mapMeta.path = data;
					break;
				case "clearPath":
					$scope.mapMeta.path = [];
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

		// overlay control
		$scope.setOverlay = function(name){
			$scope.overlayPage = name;
		};
		$scope.clearOverlay = function(){
			$scope.setOverlay(undefined);
		};

		// menu bar
		$scope.openAbout = function(){
			$scope.setOverlay("about");
			$scope.toggleMenu();
		};
		$scope.toggleProfanity = function(){
			storage.toggle("standard_messages");
			location.reload();
		};

		// general
		$scope.goToStop = function(stop){
			$location.path("/stop/" + stop.stop_id);

			// replace previous entry to maintain history consistency
			if(!$scope.atLanding){
				$location.replace();
			}
		};
		$scope.goToTrip = function(vehicle_id){
			$location.path("/trip/" + vehicle_id);
		};
		$scope.highlightStop = function(stop){
			map("highlightPoint", stop);
		};
		$scope.dehighlightStop = function(stop){
			map("dehighlightPoint", stop);
		};
	})

	.controller("overmapButtons", function($scope){
		$scope.buttons = [];

		$scope.$on("overmapButtons", function(e, obj){
			var data = obj.data;

			switch(obj.action){
				case "reset":
					$scope.buttons = [];
					break;

				case "set":
					$scope.buttons = data;
					break;
			}
		});
	})

	.controller("Landing", function($scope, $location, $mdToast, getNearbyStops, loadStopsDetails, geolocation, map, btn){
		$scope.nearbyStops = [];

		loadStopsDetails();

		map("setTargetLocation", undefined);

		// Get nearby stops by user's geolocation
		getNearbyStops(20).then(function(stops){
			$scope.nearbyStops = stops;

			map("displayPoints", stops.map(function(stop){
				return stop.stop_id;
			}));
		});

		geolocation().then(function(latlon){
			latlon.pan = true;
			map("setSelfLocation", latlon);

			btn("set", [{
				text: "Center yourself",
				onDisplay: false,
				click: function(){
					map("setSelfLocation", latlon);
				}
			}]);
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
		var refreshInterval = undefined;

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
				refreshInterval = $interval($scope.update, DEPARTURE_UPDATE_INTERVAL);
			}, function(){/*error*/});

		$scope.$on("$destroy", function(){
			if(refreshInterval)	$interval.cancel(refreshInterval);
		});

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
	})
	.controller("TripDetails", function($scope, $routeParams, $q, 
										loadStopsDetails, geolocation, TripManager, getData, getShapeAndStops, map, btn){
		var vehicle_id = $routeParams.id;
		var arrival_times = [];

		var nextStop = undefined;
		$scope.nextStopIndex = 0;

		map("reset");

		// Buttons
		btn("set", [{
			text: "Show Route",
			onDisplay: false,
			click: function(){
				if(this.onDisplay){
					map("clearPath");
				}else{
					getShapeAndStops($scope.vehicle.trip.shape_id).then(function(data){
						map("setPath", data.path.map(function(point){
							return {
								latitude: point.shape_pt_lat,
								longitude: point.shape_pt_lon
							};
						}));
					});
				}
				this.onDisplay = !this.onDisplay;
				this.text = ["Show Route", "Hide Route"][+this.onDisplay];
			}
		}]);

		// Geolocation
		geolocation().then(function(latlon){
			latlon.pan = false;
			map("setSelfLocation", latlon);
		});

		// main
		getData("GetVehicle", {vehicle_id: vehicle_id}).then(function(res){
			$scope.vehicle = res.vehicles[0];
			nextStop = res.vehicles[0].next_stop_id;

			return loadStopsDetails();
		})
		.then(function(){

			map("setTargetLocation", {
				latitude: $scope.vehicle.location.lat,
				longitude: $scope.vehicle.location.lon
			});

			var trip = $scope.vehicle.trip;
			if(trip){
				// display arrival times
				getData("GetStopTimesByTrip", {trip_id: $scope.vehicle.trip.trip_id}).then(function(res){
					$scope.arrival_times = res.stop_times;

					res.stop_times.forEach(function(stop, i){
						if(stop.stop_point.stop_id == nextStop){
							$scope.nextStopIndex = i;
						}
					});

					map("displayPoints", res.stop_times.map(function(stop){
						return stop.stop_point.stop_id;
					}));

					// scroll to correct position
					setTimeout(function(){
						var container = document.querySelector("#arrivals");
						var nextStop = document.querySelectorAll("#arrivals md-list-item")[$scope.nextStopIndex];

						$("#arrivals").animate({
							scrollTop: nextStop.offsetTop - container.clientHeight /3
						});
					}, 500);
					console.log("Next stop index: %d", $scope.nextStopIndex);
				});
			}

		});


		$scope.$on("$destroy", function(){
			console.log("clearPath");
			map("clearPath");
		});
		
	});
}