function controllers(tracker){
	tracker
	.controller("Overall", function Overall($scope, $mdToast, $location, $http, $rootScope,
									map, btn, getStopDetails, icons, TripManager, storage, MapComponentManager, Transit)
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
			//$scope.clearOverlay();
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
			//return $scope.goToStopId(stop.stop_id);
			return $scope.goToStopId(stop.id);
		};
		$scope.goToStopId = function(stop_id){
			$location.path("/stop/" + stop_id);

			// replace previous entry to maintain history consistency
			if(!$scope.atLanding){
				$location.replace();
			}
		};

		$rootScope.clearOverlay();
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

	.controller("Landing", function Landing($scope, $location, $mdToast, Transit, geolocation, btn, MapComponentManager, DEFAULT_ZOOM_LEVEL){
		$scope.nearbyStops = [];

		// fill nearby list
		Transit.getNearbyStops(20).then(function(stops){
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


		// events
		$scope.doSearch = function(){
			$location.path("/search");
		};

		$scope.centerStop = function(stop){
			MapComponentManager.loaded(function(commands){
				if(!MapComponentManager.dragging){
					commands.getMarker("all-stops", stop.id).delayedCenter().lightUp().showLabel().setIcon("stop_selected_v2", true);
				}
			});
		};
		$scope.decenterStop = function(stop){
			MapComponentManager.loaded(function(commands){
				commands.getMarker("all-stops", stop.id).cancelDelayedCenter().lightOut().hideLabel().setIcon("stop_v2", false);
			});
		};
	})

	.controller("Search", function Search($scope, $location, geolocation, MapComponentManager, Transit){
		// focus input
		setTimeout(function(){
			document.getElementById("search-input").focus();
		});

		//loadStopsDetails()
		//	.then(function(){
		
		$scope.isSearching = false;	// searching state
		$scope.searchTerm = "";    	// for textfield binding
		$scope.searchResults = []; 	// stores search results

		var highlightedStop = null;	// stores currently highlighted stop

		// performa searching
		$scope.performSearch = function(){
			$scope.isSearching = true;
			Transit.searchStops($scope.searchTerm).then(function(list){
				$scope.searchResults = list;
			})
			.finally(function(){
				$scope.isSearching = false;
			});
		};
		//	});

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

				highlightedStop = commands.getMarker("all-stops", stop.id);
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

		// reset when destroying
		$scope.$on("$destroy", function(){
			if(highlightedStop) $scope.dehighlightStop(highlightedStop);
		});
	})

	.controller("Favorites", function Favorites($scope, storage, MapComponentManager, Transit){
		//loadStopsDetails().then(function(){

		Transit.getAllStops().then(function(stops){
			$scope.stops = storage.get("favorites").map(function(stopId){
				return stops.getStop(stopId);
			});
		});


		$scope.centerStop = function(stop){
			//var stop_id = getStopIdInfo(stop.stop_id).stop_id;

			MapComponentManager.loaded(function(commands){
				if(!MapComponentManager.dragging)
					commands.getMarker("all-stops", stop.rootId).delayedCenter().lightUp().showLabel().setIcon("stop_selected_v2", true);
			});
			
		};
		$scope.decenterStop = function(stop){
			//var stop_id = getStopIdInfo(stop.stop_id).stop_id;

			MapComponentManager.loaded(function(commands){
				commands.getMarker("all-stops", stop.rootId).lightOut().hideLabel().setIcon("stop_v2", false);
			});
		};
	})

	.controller("StopDetails", function StopDetails($scope, $routeParams, $interval, $mdToast,
			map, timer, MapComponentManager, Transit)
	{
		$scope.stop = null;              	// Target stop
		$scope.stop_id = $routeParams.id;	// Target stop id
		$scope.stop_points_list = [];    	// List of substops
		$scope.departures = undefined;   	// List of Departures
		$scope.stopNotExists = false;    	// True if stop cannot be found
		$scope.selectedBus = null;       	// Selected bus

		var departuresList;     	// Observable DeparturesList
		var targetMarker = null;	// Target marker
		var mapRoutePolyline;   	// Bus route path, defined when a bus is selected


		Transit
		// get matched stops
		.getStop($scope.stop_id, true)
		// handle matched stops list
		.then(function(stops){
			// select stop
			$scope.stop = stops[0];
			// inflate substop dropdown list
			$scope.stop_points_list = stops;
			// highlight stop marker
			MapComponentManager.loaded(function(commands){
				targetMarker = commands.getMarker("all-stops", $scope.stop.rootId);
				targetMarker.showLabel().lightUp().center().setIcon("stop_selected_v2", true).set("iconHoverable", false);
			});

			return $scope.stop;
		})
		// get departures
		.then(function(stop){
			return stop.getUpcomingDepartures();
		})
		// set up departures observer
		.then(function(list){
			departuresList = list;
			$scope.departures = list.departures;
			list.observe(function(){
				console.log("[StopDetails]", "Last updated on " + new Date());
				$scope.departures = list.departures;
			});
		})
		// if any of the previous operations failed
		.catch(function(){
			$scope.stopNotExists = true;	// stop not exist
		});

		// on destroy
		$scope.$on("$destroy", function(){
			// clear departures updating
			if(departuresList)	departuresList.clearObserve();
			// reset marker state
			if(targetMarker)	targetMarker.hideLabel().lightOut().setIcon("stop_v2").set("iconHoverable", true);
			// deselect any selected route
			$scope.deselectRoute();
		});
		

		$scope.addTimer = function(departure){
			timer("prompt", departure);
		};

		// display a bus route
		$scope.displayBusRoute = function(bus){
			function displayRoute(bus){
				bus.getCurrentRoute().then(function(route){
					MapComponentManager.loaded(function(commands){
						// return if user selected another route to display
						if($scope.selectedBus !== bus)	return;

						// display bus location
						var location = commands.getMarker("bus-route", "bus-location");
						location.setIcon("bus-" + bus.routeName);
						location.setPosition(bus.location);
						location.set("caption", "Bus #" + bus.id + " was here a moment ago");
						location.set("visible", true);
						location.center();

						// display path
						mapRoutePolyline = new google.maps.Polyline({
							path: route.path,
							geodesic: true,
							strokeColor: bus.routeColor,
							strokeOpacity: 1.0,
							strokeWeight: 5
						});
						mapRoutePolyline.setMap(MapComponentManager.map);

						// filter stops
						commands.getSet("all-stops").hide().isHiding = false;
						route.stops.forEach(function(stopId){
							commands.getMarker("all-stops", stopId).show();
						});

						// observe bus location
						bus.observe(function(bus){
							console.log("Updated bus", bus);
							location.setPosition(bus.location);
							location.center();
						});
					});
				});
			}

			var onlyDeselecting = $scope.selectedBus && bus.id === $scope.selectedBus.id;

			// hide existing route
			$scope.deselectRoute();
			
			if(onlyDeselecting){
				// we are done
				return true;
			}else{
				$scope.selectedBus = bus;
			}

			// display route
			displayRoute(bus);
		}

		// remove bus route from map
		$scope.deselectRoute = function(){
			if($scope.selectedBus){
				// clear observe
				$scope.selectedBus.clearObserve();
				$scope.selectedBus = null;

				MapComponentManager.loaded(function(commands){
					// hide bus location
					commands.getMarker("bus-route", "bus-location").set("visible", false);

					// clear path polyline
					mapRoutePolyline.setMap(null);
					mapRoutePolyline = null;

					// display all stops
					commands.getSet("all-stops").show();

					// move to stop location
					targetMarker.center();
				});
			}
		};
	})
}