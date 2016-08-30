function controllers(tracker){
	tracker
	.controller("Overall", function Overall($scope, $mdToast, $location, $http, $rootScope,
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

	    // when map is loaded
		MapComponentManager.loaded(function(commands){
			console.log("[Map]", "Map loaded.");
			$scope.clearOverlay();
		});

	    // Global functions
	    $scope.toggleMenu = function(){
			$scope.menuClosed = !$scope.menuClosed;
	    };
	    $scope.navBack = function(){
			history.back();
	    };

		// overlay control
		$rootScope.setOverlay = function(name){
			$scope.overlayPage = name;
		};
		$rootScope.clearOverlay = function(){
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
			return $scope.goToStopId(stop.stop_id);
		};
		$scope.goToStopId = function(stop_id){
			$location.path("/stop/" + stop_id);

			// replace previous entry to maintain history consistency
			if(!$scope.atLanding){
				$location.replace();
			}
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

		/** Executed when a timer is done */
		function timerDone(timer){
			var notification = new Notification("Your bus will be coming in " + timer.timerInterval + " minutes!", {
				body: timer.headsign + " @ " + timer.stop.stop_name,
				icon: "icons/notification_icon.png",
				requireInteraction: true	/* Chrome specific */
			});
			var audio = new Audio("assets/alert.mp3");
			audio.loop = true;
			audio.play();

			notification.onclose = function(){
				audio.pause();
			};
		}

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
					timerDone(timer);
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
								$scope.timerInterval = Math.max($scope.timerInterval - 1, 0);
							};
							$scope.setTimer = function(){
								var toast = $mdToast.simple().position("top right")

								function returnData(){
									$mdDialog.hide({
										targetTime: expectedTime - $scope.timerInterval * 60 * 1000,
										timerInterval: $scope.timerInterval
									});
								}

								if(!window.Notification){
									toast.textContent("Your browser does not support notifications.");
									$mdToast.show(toast);
								}else if(Notification.permission == "denied"){
									toast.textContent("You must allow notifications.");
									$mdToast.show(toast);
								}else if(Notification.permission == "granted"){
									returnData();
								}else{
									Notification.requestPermission(function(permission){
										if(permission === "granted"){
											returnData();
										}else{
											toast.textContent("You must allow notifications.");
										}
									});
								}
							};
						}
					}).then(function(formData){
						var currentTime = Date.now();

						$scope.timers.push({
							headsign: data.headsign,
							vehicle_id: data.vehicle_id,
							stop: getStopDetails(data.stop_id),
							targetTime: formData.targetTime,
							timerInterval: formData.timerInterval,
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
			getNearbyStops, loadStopsDetails, geolocation, map, btn, MapComponentManager, delayedCall, DEFAULT_ZOOM_LEVEL)
	{
		$scope.nearbyStops = [];

		loadStopsDetails().then(function(){

			// Get nearby stops by user's geolocation
			getNearbyStops(20).then(function(stops){
				$scope.nearbyStops = stops;
			});

			geolocation().then(function(latlon){
				MapComponentManager.loaded(function(commands){
					var marker = commands.getMarker("user", "self-location");

					marker.setPosition({lat: latlon.latitude, lng: latlon.longitude});
					marker.set("visible", true);
					marker.center();


					btn("set", [{
						text: "Center yourself",
						onDisplay: false,
						click: function(){
							marker.center(DEFAULT_ZOOM_LEVEL);
						}
					}]);
				});
				
			});
		});


		// events
		$scope.doSearch = function(){
			$location.path("/search");
		};

		$scope.centerStop = function(stop){
			MapComponentManager.loaded(function(commands){
				if(!MapComponentManager.dragging){
					commands.getMarker("all-stops", stop.stop_id).delayedCenter().lightUp().showLabel().setIcon("stop_selected_v2", true);
				}
			});
		};
		$scope.decenterStop = function(stop){
			MapComponentManager.loaded(function(commands){
				commands.getMarker("all-stops", stop.stop_id).cancelDelayedCenter().lightOut().hideLabel().setIcon("stop_v2", false);
			});
		};
	})

	.controller("Search", function Search($scope, $location, geolocation, loadStopsDetails, getAutocomplete, map, MapComponentManager){
		// focus input
		setTimeout(function(){
			document.getElementById("search-input").focus();
		});

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
					}, function(){
						$scope.isSearching = false;
					});
				};
			});

		var highlightedStop = null;

		// go to first stop in search results
		$scope.goToFirstOption = function(e){
			if(e.keyCode != 13)	return true;
			if($scope.searchResults.length){
				$scope.goToStop($scope.searchResults[0]);
			}
		};
		$scope.stopOnClick = function(stop){
			$scope.goToStop(stop);
		}
		$scope.highlightStop = function(stop){
			MapComponentManager.loaded(function(commands){
				if(highlightedStop)	highlightedStop.set("iconHoverable", true);

				highlightedStop = commands.getMarker("all-stops", stop.stop_id);
				highlightedStop.delayedCenter().lightUp().showLabel().setIcon("stop_selected_v2", true);
				highlightedStop.set("iconHoverable", false);
			});
		};
		$scope.dehighlightStop = function(stop){
			MapComponentManager.loaded(function(commands){
				highlightedStop.cancelDelayedCenter().lightOut().hideLabel().setIcon("stop_v2", false);
				highlightedStop.set("iconHoverable", true);
			});
		};

		$scope.$on("$destroy", function(){
			if(highlightedStop) highlightedStop.set("iconHoverable", true);
		});
	})

	.controller("Favorites", function Favorites($scope, loadStopsDetails, storage, getStopDetails, getStopIdInfo, map, MapComponentManager){
		loadStopsDetails().then(function(){

			$scope.stops = storage.get("favorites").map(function(stop_id){
				return getStopDetails(stop_id);
			});
		});


		$scope.centerStop = function(stop){
			var stop_id = getStopIdInfo(stop.stop_id).stop_id;

			MapComponentManager.loaded(function(commands){
				if(!MapComponentManager.dragging)
					commands.getMarker("all-stops", stop_id).moveIntoBound().lightUp().showLabel().setIcon("stop_selected_v2", true);
			});
			
		};
		$scope.decenterStop = function(stop){
			var stop_id = getStopIdInfo(stop.stop_id).stop_id;

			MapComponentManager.loaded(function(commands){
				commands.getMarker("all-stops", stop_id).lightOut().hideLabel().setIcon("stop_v2", false);
			});
		};
	})

	.controller("StopDetails", function StopDetails($scope, $routeParams, $interval, $mdToast,
			loadStopsDetails, getStopDetails, getStopIdInfo, getUpcomingBuses, map, timer, DEPARTURE_UPDATE_INTERVAL,
			MapComponentManager, getShapeAndStops, ROUTE_COLORS, getData)
	{
		var stop = $scope.id = {};
		var stop_id = $scope.stop_id = $routeParams.id;
		var stop_points_list = $scope.stop_points_list = [];
		var refreshInterval = undefined;

		// target marker
		var targetMarker = null;

		// store data about selected departure
		$scope.selectedDeparture = {
			route: null,
			entry: null
		};

		loadStopsDetails().then(function(){
			var stop = $scope.stop = getStopDetails(stop_id),
				stopInfo = getStopIdInfo(stop_id);

			var combinedStop = $scope.combinedStop = getStopDetails(stopInfo.stop_id);

			if(!stop){
				$scope.stopNotExists = true;
				return;
			}
			
			stop_points_list = $scope.stop_points_list = [combinedStop].concat(combinedStop.stop_points);
		
			MapComponentManager.loaded(function(commands){
				targetMarker = commands.getMarker("all-stops", stopInfo.stop_id);
				targetMarker
					.showLabel().lightUp().center().setIcon("stop_selected_v2", true).set("iconHoverable", false);
			});

			$scope.update();
			refreshInterval = $interval($scope.update, DEPARTURE_UPDATE_INTERVAL);
		}, function(){/*error*/});

		$scope.$on("$destroy", function(){
			if(refreshInterval)	$interval.cancel(refreshInterval);
			//if(targetMarker) targetMarker.hideLabel().lightOut().set("iconHoverable", true);
			if(targetMarker) targetMarker.hideLabel().lightOut().setIcon("stop_v2").set("iconHoverable", true);

			$scope.deselectRoute();
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

			// TODO: update bus location
		};

		$scope.addTimer = function(departure){
			timer("prompt", departure);
		};

		$scope.selectRoute = function(departure){
			var onlyDeselecting = $scope.selectedDeparture.entry && departure.vehicle_id === $scope.selectedDeparture.entry.vehicle_id;

			// hide existing route
			$scope.deselectRoute();

			//MapComponentManager.map.set("minZoom", 12);

			var routeName = departure.route.route_id.toLowerCase().split(" ")[0];

			// return if user is trying to deselect entry
			if(onlyDeselecting)	return true;

			// create new route
			getShapeAndStops(departure.trip.shape_id).then(function(data){
				MapComponentManager.loaded(function(commands){
					// return if user selected another route to display
					if(!departure.selected)	return;

					// display path
					var latlngs = data.path.map(function(point){
						return {lat: point.shape_pt_lat, lng: point.shape_pt_lon};
					});

					$scope.selectedDeparture.route = new google.maps.Polyline({
						path: latlngs,
						geodesic: true,
						strokeColor: ROUTE_COLORS[routeName],
						strokeOpacity: 1.0,
						strokeWeight: 5
					});
					$scope.selectedDeparture.route.setMap(MapComponentManager.map);

					// filter stops
					commands.getSet("all-stops").hide();
					data.stops.forEach(function(stop){
						commands.getMarker("all-stops", stop.stop_id.split(":")[0]).show();
					});
				});
			});

			getData("GetVehicle", {vehicle_id: departure.vehicle_id}).then(function(res){
				var vehicle = res.vehicles[0];
				
				// return if user selected another route to display
				if(!departure.selected)	return;

				MapComponentManager.loaded(function(commands){
					var location = commands.getMarker("bus-route", "bus-location");
					location.setIcon("bus-" + routeName);
					location.setPosition({
						lat: vehicle.location.lat, lng: vehicle.location.lon
					});
					location.set("visible", true);
					location.center();
				});
			});

			// mark as selected
			$scope.selectedDeparture.entry = departure;
			$scope.selectedDeparture.entry.selected = true;
		};

		$scope.deselectRoute = function(){
			//MapComponentManager.map.set("minZoom", 17);

			if($scope.selectedDeparture.entry){
				MapComponentManager.loaded(function(commands){
					$scope.selectedDeparture.route.setMap(null);
					$scope.selectedDeparture.route = null;

					$scope.selectedDeparture.entry.selected = false;
					$scope.selectedDeparture.entry = null;

					// hide bus location
					commands.getMarker("bus-route", "bus-location").set("visible", false);

					// display all stops
					commands.getSet("all-stops").show();

					// move to stop location
					targetMarker.center();
				});
			}
		};
	})
}