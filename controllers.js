function controllers(tracker){
	tracker
	.controller("Overall", function Overall($scope, $mdToast, $location, $http, uiGmapIsReady, 
									map, btn, getStopDetails, icons, TripManager, storage, MapComponentManager)
	{
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

			// Reset menu
			$scope.menuClosed = true;
	    });
	    $scope.$on("$routeChangeError", function(e, current, previous, rejection){
			var toast = $mdToast.simple().position("top right").textContent("Failed to load " + current.$$route.controller);
			$mdToast.show(toast);
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
			selfLocationOptions: {
				opacity: 0.6
			},
			selfLocationEvents: {
				// temp hack
				mouseover: function(){
					$scope.mapMeta.selfLocationOptions.opacity = 1;
				},
				mouseout: function(){
					$scope.mapMeta.selfLocationOptions.opacity = 0.6;
				}
			},
			targetLocation: undefined,
			targetLocationOptions: {
				opacity: 1
			},
			points: [],
			pointsOptions: {
			},
			_points: {},

			path: [],
			pathStroke: {
				weight: 5,
				color: "rgba(255, 243, 0, 204)"
			},

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

		// Pass control to MapComponentManager
		$scope.markers = MapComponentManager.setControl($scope.mapMeta.control);

	    uiGmapIsReady.promise().then(function(){
			$scope.mapMeta.selfLocationOptions.icon = icons("home");
			$scope.mapMeta.targetLocationOptions.icon = icons("stop");

			$scope.mapMeta.backdrop = {
				getTile: function(coord, zoomm, owner){
					var div = owner.createElement("div");
					div.style.background = "rgba(45, 56, 64, 0.65)";
					div.style.width = this.tileSize.width + "px";
					div.style.height = this.tileSize.height + "px";
					return div;
				},
				tileSize: new google.maps.Size(1e5, 1e5),
				name: "backdrop",
				maxZoom: 17
			};

			$http.get("styles/map-style.json").then(function(styles){
				$scope.mapMeta.control.getGMap().setOptions({styles: styles.data});
			});

			$scope.$emit("mapLoaded");
		});

		$scope.$on("mapLoaded", function(e){
			console.log("[Map]", "Map loaded.");
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
					$scope.mapMeta.selfLocationEvents.click = function(){
						map("moveTo", data);
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
		$scope.goToFavorites = function(){
			$location.path("/favorites");
		};
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
			map("moveIntoBound", {latitude: stop.mid_lat, longitude: stop.mid_lon});
		};
		$scope.dehighlightStop = function(stop){
			map("dehighlightPoint", stop);
		};
	})

	.controller("overmapTimers", function OvermapTimers($scope, $mdDialog, $interval, $mdToast, storage, uuid, getStopDetails){
		$scope.timers = storage.get("timers");
		$scope.rightClicked = false;

		var lastUpdated = 0;
		var refreshInterval = $interval(update, 1000);

		// listen to storage change
		window.addEventListener("storage", function(e){
			// another instance has already updated the list
			if(e.key == "timers"){
				lastUpdated = Date.now();
				$scope.timers = storage.get("timers");	// update internal memory
			}
		});

		function update(forceUpdate){
			var itemsModified = false;
			var currentTime = Date.now();

			// do nothing if another instance has already updated the information
			if(!forceUpdate && lastUpdated - currentTime < 1000*60)	return;

			$scope.timers.forEach(function(timer, i){
				timer.remainingTime = timer.targetTime - currentTime;

				// remove timer when it is done
				if(timer.remainingTime <= 0){
					$scope.timers[i] = undefined;
					itemsModified = true;
					new Notification("Your " + timer.timerInterval + " minutes timer is up.", {body: timer.headsign + " @ " + timer.stop.stop_name});
				}

			});

			// remove empty spots
			$scope.timers = $scope.timers.filter(function(timer){ return !!timer; });

			// Stringify only when items removed
			if(itemsModified)	storage.set("timers", $scope.timers);
		}

		$scope.displayRemove = function($event){
			$scope.rightClicked = !$scope.rightClicked;
		};

		$scope.removeTimer = function(i){
			$scope.timers.splice(i, 1);
			storage.set("timers", $scope.timers);
			$scope.rightClicked = false;
		};

		$scope.$on("overmapTimers", function(e, obj){
			var data = obj.data;

			switch(obj.action){
				case "prompt":
					var expectedTime = +new Date(data.expected);

					$mdDialog.show({
						templateUrl: "templates/set_timer.html",
						clickOutsideToClose: true,
						controller: function($scope){
							$scope.timerInterval = 1;

							$scope.increase = function(){
								$scope.timerInterval = Math.min($scope.timerInterval + 1, Math.floor((expectedTime - Date.now()) / 1000 / 60));
							};
							$scope.decrease = function(){ 
								$scope.timerInterval = Math.max($scope.timerInterval - 1, 1);
							};
							$scope.setTimer = function(){
								var toast = $mdToast.simple().position("top right")
								if(!window.Notification){
									toast.textContent("Your browser does not support notifications.");
									$mdToast.show(toast);
								}else if(Notification.permission == "denied"){
									toast.textContent("You must allow notifications.");
									$mdToast.show(toast);
								}else if(Notification.permission == "granted"){
									$mdDialog.hide($scope.timerInterval);
								}else{
									Notification.requestPermission(function(permission){
										if(permission == "granted"){
											$mdDialog.hide($scope.timerInterval);
										}else{
											toast.textContent("You must allow notifications.");
										}
									});
								}
							};
						}
					}).then(function(timerInterval){
						var currentTime = Date.now();

						$scope.timers.push({
							headsign: data.headsign,
							vehicle_id: data.vehicle_id,
							stop: getStopDetails(data.stop_id),
							/*expectedTime: expectedTime,*/
							targetTime: currentTime + timerInterval * 60 * 1000,
							/*minsBeforeExpected: timerInterval,*/
							timerInterval: timerInterval,
							timer_id: uuid()
						});
						storage.set("timers", $scope.timers);

						update(true);
					});
			}
		});

		$scope.$on("$destroy", function(){
			if(refreshInterval)	$interval.cancel(refreshInterval);
		});
	})

	.controller("overmapButtons", function OvermapButtons($scope){
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

	.controller("Landing", function Landing($scope, $location, $mdToast, 
			getNearbyStops, loadStopsDetails, geolocation, map, btn, MapComponentManager){
		$scope.nearbyStops = [];

		loadStopsDetails().then(function(){

			map("setTargetLocation", undefined);

			// Get nearby stops by user's geolocation
			getNearbyStops(20).then(function(stops){
				$scope.nearbyStops = stops;

				/*
				map("displayPoints", stops.map(function(stop){
					return stop.stop_id;
				}));*/
				var nearbyStopMarkers = new MapComponentManager.Set("nearbyStops");
				stops.forEach(function(stop){
					var stopMarker = new MapComponentManager.Marker(
						stop.stop_id,
						{
							latitude: stop.mid_lat,
							longitude: stop.mid_lon,
							canIconHover: true,
							iconName: "stop",
							label: stop.stop_name,
							on: {
								click: function(){
									$scope.goToStop(stop);
								}
							}
						}
					);

					nearbyStopMarkers.addMarker(stopMarker);
				});
			});

			geolocation().then(function(latlon){
				//latlon.pan = true;
				//map("setSelfLocation", latlon);
				var marker = MapComponentManager.getMarker("user", "self-location");

				marker
					.setLocation(latlon.latitude, latlon.longitude)
					.setVisible(true)
					.center();


				btn("set", [{
					text: "Center yourself",
					onDisplay: false,
					click: function(){
						//map("setSelfLocation", latlon);
						MapComponentManager.setCenter(latlon);
					}
				}]);
			});
		});


		// events
		$scope.doSearch = function(){
			$location.path("/search");
		};
		$scope.centerStop = function(stop){
			MapComponentManager.getMarker("nearbyStops", stop.stop_id).center().lightUp();
		};
		$scope.decenterStop = function(stop){
			MapComponentManager.getMarker("nearbyStops", stop.stop_id).lightOut();
		};
	})

	.controller("Search", function Search($scope, $location, geolocation, loadStopsDetails, getAutocomplete, map){
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

	.controller("Favorites", function Favorites($scope, loadStopsDetails, storage, getStopDetails, map){
		loadStopsDetails().then(function(){

			$scope.stops = storage.get("favorites").map(function(stop_id){
				return getStopDetails(stop_id);
			});

			map("reset");
		});
	})

	.controller("StopDetails", function StopDetails($scope, $routeParams, $interval, $mdToast,
										loadStopsDetails, getStopDetails, getUpcomingBuses, map, timer, DEPARTURE_UPDATE_INTERVAL)
	{
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

		$scope.addTimer = function(departure){
			timer("prompt", departure);
		};
	})
	.controller("TripDetails", function TripDetails($scope, $routeParams, $q, 
										loadStopsDetails, geolocation, TripManager, getData, getShapeAndStops, map, btn)
	{
		var vehicle_id = $routeParams.id;
		var arrival_times = [];

		var nextStop = undefined;
		$scope.nextStopIndex = 0;

		map("reset");

		// Buttons
		btn("set", [{
			text: "Hide Route",
			onDisplay: true,
			click: function(){
				if(this.onDisplay){
					map("clearPath");
				}else{
					showRoute();
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

				// show route by default
				showRoute();
			}

		});


		function showRoute(){
			getShapeAndStops($scope.vehicle.trip.shape_id).then(function(data){
				map("setPath", data.path.map(function(point){
					return {
						latitude: point.shape_pt_lat,
						longitude: point.shape_pt_lon
					};
				}));
			});
		}


		$scope.$on("$destroy", function(){
			console.log("clearPath");
			map("clearPath");
		});
	});
}