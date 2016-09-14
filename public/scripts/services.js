function services(tracker){
	tracker

	// Storage service
	.factory("storage", function storage(){
		var methods = {
			exists: function(key){
				return localStorage[key] !== undefined;
			},
			get: function(key){
				var data = localStorage.getItem(key);
				if(data === null)	return null;
				else             	return JSON.parse(localStorage[key]);
			},
			set: function(key, value){
				localStorage.setItem(key, JSON.stringify(value));
			},
			remove: function(key){
				localStorage.removeItem(key);
			},
			toggle: function(key){
				this.set(key, !this.get(key));
			}
		};

		return methods;
	})

	// Geolocation - returns a deferred promise
	.service("geolocation", function geolocation($q){
		var ongoingRequest = false;	// This is to deal with bullshit Firefox behavior
		                           	//  where .getCurrentPosition only fires once
		                           	//  even when called multiple times

		return function(){
			var deferred = $q.defer();

			if(!ongoingRequest){
				ongoingRequest = deferred.promise;
				navigator.geolocation.getCurrentPosition(function(pos){
					deferred.resolve({latitude: pos.coords.latitude, longitude: pos.coords.longitude});
					ongoingRequest = undefined;
				}, function(){
					deferred.reject();
					ongoingRequest = undefined;
				});
			}else{
				ongoingRequest.then(function(latlng){
					deferred.resolve(latlng);
				}, function(){
					deferred.reject();
				});
			}

			return deferred.promise;
		};
	})

	// shortcut for broadcasting map events
	.service("map", function map($rootScope){
		return function(action, data){
			//$rootScope.$broadcast("map", {action: action, data: data});
		};
	})

	.service("timer", function timer($rootScope){
		return function(action, data){
			$rootScope.$broadcast("overmapTimers", {action: action, data: data});
		}
	})

	.service("btn", function btn($rootScope){
		return function(action, data){
			$rootScope.$broadcast("overmapButtons", {action: action, data: data});
		}
	})

	// icons generator
	.service("icons", function icons(){
		var icons = {
			"home_v2": {
				url: "icons/map_icon_set_v2.svg",
				size: {width: 42, height: 76},
				origin: {x: 0, y: 0}
			},
			"stop_v2": {
				url: "icons/map_icon_set_v2.svg",
				size: {width: 42, height: 76},
				origin: {x: 0, y: 76}
			},
			"stop_selected_v2": {
				url: "icons/map_icon_set_v2.svg",
				size: {width: 42, height: 76},
				origin: {x: 0, y: 152}
			}
		}, icons_mini = {
			"home_v2": {
				url: "icons/map_icon_set_v2_mini.svg",
				size: {width: 24, height: 24},
				origin: {x: 0, y: 0}
			},
			"stop_v2": {
				url: "icons/map_icon_set_v2_mini.svg",
				size: {width: 24, height: 24},
				origin: {x: 0, y: 24}
			},
			"stop_selected_v2": {
				url: "icons/map_icon_set_v2_mini.svg",
				size: {width: 24, height: 24},
				origin: {x: 0, y: 48}
			}

		}, icons_hover = {};

		for(var key in icons){
			var icon = icons[key];
			icon.anchor = {x: icon.size.width/2, y: icon.size.height};

			var icon_hover = icons_hover[key] = angular.copy(icon);
			icon_hover.origin.x += icon.size.width;

			var icon_mini = icons_mini[key];
			icon_mini.anchor = {x: icon_mini.size.width/2, y: icon_mini.size.height/2};
		}

		var busMarkerList = [
			["yellow", "yellowhopper"], "red", "lavender", "blue", ["green", "greenhopper"],
			["orange", "orangehopper"], "grey", "bronze", "brown", "gold",
			"ruby", "teal", "silver", "navy", "pink",
			"raven", "illini", "lime", "transport"
		];

		busMarkerList.forEach(function(busName, i){
			function addBusMarker(name){
				icons_hover["bus-" + name] = icons["bus-" + name] = {
					url: "icons/bus_icon_set.svg",
					size: {width: 65, height: 65},
					origin: {x: i % 5 * 65, y: (i / 5 | 0) * 65},
					anchor: {x: 65 / 2, y: 65 / 2}
				};
			}
			if(typeof busName === "string"){
				addBusMarker(busName);
			}else{
				busName.forEach(addBusMarker);
			}
		});

		return function (name, isHover, useMini){
			if(!name)       	return undefined;
			if(!icons[name])	throw "Icon \"" + name + "\" does not exist.";

			if(useMini && icons_mini[name]) 	return icons_mini[name]; 	// mini icons, mini overrides hover
			if(isHover && icons_hover[name])	return icons_hover[name];	// hover icons
			else                            	return icons[name];      	// fallback
		}
	})

	// random value provider
	.service("random", function random($rootScope){
		var randomValue;

		generateRandomValue();
		$rootScope.$on("$routeChangeSuccess", generateRandomValue);

		function generateRandomValue(){
			randomValue = Math.random();
		}

		return function(){
			return randomValue;
		};
	})

	// uuid
	.service("uuid", function uuid(){
		return function(){
			// Stackoverflow
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
				return v.toString(16);
			});
		}
	})

	// route colors
	.service("routeColor", function routeColor(){
		
	})

	// Load stops database - Fetch from web if data is outdated or missing
	.service("loadStopsDetails", function loadStopsDetails(DATA_STORAGE_KEY, $q, stop_details, storage, getData){
		var deferred;

		return function(){
			// if it is already in progress
			if(deferred){
				return deferred.promise;
			}

			deferred = $q.defer();

			// Database already loaded
			if(stop_details.loaded){
				deferred.resolve(stop_details.stops);
			}else{
			
				// Database not loaded
				console.log("[loadStopsDetails]", "Checking for changes in database...");
				getData("GetStops", storage.exists(DATA_STORAGE_KEY) ? {
					changeset_id: storage.get(DATA_STORAGE_KEY).changeset_id
				}: undefined).then(function(res){

					if(!res.new_changeset){
						// no change
						stop_details.stops = storage.get(DATA_STORAGE_KEY).stops;
						stop_details.loaded = true;
						deferred.resolve(stop_details.stops);

						console.log("[loadStopsDetails]", "Database not changed.");
					}else{
						// update

						var stops = {};
						res.stops.forEach(function(stop){
							stops[stop.stop_id] = stop;
							stop.mid_lat = 0;
							stop.mid_lon = 0;

							stop.stop_points.forEach(function(stop_point){
								stop.mid_lat += stop_point.stop_lat;
								stop.mid_lon += stop_point.stop_lon;
							});

							stop.mid_lat /= stop.stop_points.length;
							stop.mid_lon /= stop.stop_points.length;
						});
						storage.set(DATA_STORAGE_KEY, {
							stops: stops,
							changeset_id: res.changeset_id
						});

						stop_details.stops = stops;
						stop_details.loaded = true;

						deferred.resolve(stop_details.stops);
						console.log("[loadStopsDetails]", "Database updated.");
					}

				}, function(){
					console.error("[loadStopsDetails]", "Cannot update");
					
					if(storage.exists(DATA_STORAGE_KEY)){
						// use cached data
						stop_details.stops = storage.get(DATA_STORAGE_KEY).stops;
						stop_details.loaded = true;
						deferred.resolve(stop_details.stops);
					}else{
						// no data available
						deferred.reject();
					}
				});
			}

			return deferred.promise;
		}
	})

	// Handle communications to the API server
	.service("getData", function getData($q, $http, $filter){
		var key = "77b92e5ceef640868adfc924c1735ac3";

		var interface = function(method, data){
			var deferred = $q.defer();
			console.log("[getData]", method, angular.copy(data));

			if(data === undefined)	data = {};
			data.key = key;
			$http.get("https://developer.cumtd.com/api/v2.2/json/" + method, {
				params: data
			})
				.then(function(res){
					console.log("[getData] Server responded to %s with status %d", method, res.data.status.code);
					if(res.data.status.code != 200){
						console.error("[" + method + "]", res.data.status.msg);
						deferred.reject(res.data.status.msg);
					}
					deferred.resolve(res.data);
				}, function(res){
					deferred.reject(res.message);
				});

			return deferred.promise;
		};

		window.getUsage = function(){
			var date = new Date();
			date.setDate(date.getDate() - 1);	// yesterday
			var dateString = $filter("date")(date, "yyyy-MM-dd");

			interface("GetApiUsage", { start_date: dateString }).then(function(data){
				console.log("Stats for " + dateString + ":\n" + JSON.stringify(data.days[0].versions[0], null, 4));
			});
		};

		return interface;
	})

	// Handle communications to the autocomplete API server
	.service("getAutocomplete", function getAutocomplete($q, $http, getStopDetails){
		return function(input){
			var deferred = $q.defer();

			if(!input){
				deferred.resolve([]);
			}else{
				$http.get("https://www.cumtd.com/autocomplete/Stops/v1.0/json/search", {
					params: {
						query: input
					}
				})
					.then(function(res){
						deferred.resolve(res.data.map(function(stop){
							return getStopDetails(stop.i);
						}));
					}, function(){
						console.error("[getAutocomplete]", "JSONP failed");
						deferred.reject();
					});
			}

			return deferred.promise;
		}
	})

	// Get nearby stops
	.service("getNearbyStops", function getNearbyStops($q, getData, geolocation, getStopDetails){
		return function(count){
			var deferred = $q.defer();
			var data = {};

			if(count != undefined)	data.count = count;

			geolocation()
				.then(function(location){
					data.lat = location.latitude;
					data.lon = location.longitude;

					getData("GetStopsByLatLon", data)
						.then(function(res){
							deferred.resolve(res.stops.map(function(stop){
								return getStopDetails(stop.stop_id);
							}));
						}, function(){
							deferred.reject([]);
						});
			});

			return deferred.promise;
		}
	})

	// Get upcoming buses
	.service("getUpcomingBuses", function getUpcomingBuses($q, getData){
		return function(id){
			var deferred = $q.defer();

			getData("GetDeparturesByStop", {
				stop_id: id
			})
				.then(function(res){
					deferred.resolve(res.departures);
				}, function(error_message){
					deferred.reject(error_message);
				});

			return deferred.promise;
		};
	})

	// parse stop id
	.service("getStopIdInfo", function getStopInfo(){
		return function(stop_id){
			if(typeof stop_id !== "string")	return null;

			var parts = stop_id.split(":"),
				combinedStopId = parts[0],
				stopPointId = parts.length === 2 ? parts[1] : "";

			return {
				stop_id: combinedStopId,
				stop_point_id: stopPointId
			};
		}
	})

	// Get stop details from database
	.service("getStopDetails", function getStopDetails(stop_details, getStopIdInfo){
		return function(stop_id){
			var stopInfo = getStopIdInfo(stop_id),
				combinedStop = stop_details.stops[stopInfo.stop_id];

			if(stopInfo.stop_point_id !== ""){
				// fast enough
				return combinedStop.stop_points.filter(function(stop){
					return stop.stop_id === stop_id;
				})[0];
			}else{
				return combinedStop;
			}
		};
	})


	// Trip manager
	.factory("TripManager", function TripManager($q, getData){
		var trips = {};

		return {
			setTrip: function(trip_id, trip){
				trips[trip_id] = trip;
			},
			getTrip: function(trip_id){
				var deferred = $q.defer();

				if(trip_id in trips){
					deferred.resolve(trips[trip_id]);
				}else{
					getData("GetTrip", {
						trip_id: trip_id
					}).then(function(res){
						if(!res.trips.length){
							deferred.reject();
						}else{
							trips[trip_id] = res.trips[0];
							deferred.resolve(res.trips[0]);
						}
					}, function(){
						deferred.reject();
					})
				}

				return deferred.promise;
			}
		};
	})

	.service("getShapeAndStops", function getShapeAndStops($q, getData, getStopDetails){
		// cache
		var shapes = {};

		return function(shape_id){
			var deferred = $q.defer();

			if(shape_id in shapes){
				deferred.resolve(shapes[shape_id]);
			}else{
				getData("GetShape", {
					shape_id: shape_id
				}).then(function(res){
					var result = {
						stops: [],
						path: res.shapes
					};

					result.stops = res.shapes.reduce(function(prev, cur){
						if("stop_id" in cur){
							prev.push(getStopDetails(cur.stop_id));
							return prev;
						}else{
							return prev;
						}
					}, []);

					shapes[shape_id] = result;

					deferred.resolve(result);
				}, function(){
					deferred.reject();
				})
			}

			return deferred.promise;
		};
	})

	.service("delayedCall", function(){
		return function(delayInMs, callback){
			var timer = 0;

			return {
				call: function(){
					var args = arguments;
					if(timer)	clearTimeout(timer);

					timer = setTimeout(function(){
						callback.apply(null, args);
					}, delayInMs);
				},
				cancel: function(){
					clearTimeout(timer);
				}
			};
		};
	})

	.service("MapComponentManager", function MapComponentManager(icons, $q, delayedCall, isSmallScreen, delayedCall){
		var isLoaded = false,
			smallScreen = isSmallScreen;	// initialize once at startup
		
		function setup(map){

			function isMiniMode(){
				return map.getZoom() < 17;
			}

			/**
			 * @class A marker tooltip class
			 * @param {Object} options
			 * @param {Map}	map a gmap
			 *
			 * Options:
			 *	- position
			 *	- visible
			 *	- iconName
			 *	- caption
			 *	- iconHoverable
			 *	- level	(bottom, common, focus, top)
			 *	- events (object containing functions)
			 *	- data (custom data)
			 */
			function MarkerTooltip(options, map){
				//console.log("Tooltip constructor", map);

				var self = this;
				var marker = this.marker = new google.maps.Marker();
			
				this.setValues({
					position: new google.maps.LatLng(options.position),
					visible: options.visible === undefined ? true : false,
					iconName: options.iconName,
					caption: options.caption,
					iconHoverable: options.iconHoverable === undefined ? false : true,
					level: options.level || "common",
					events: options.events,
					isHiding: false,
					onGoingAnimation: undefined,
					data: options.data,
					supportsMini: !!options.supportsMini
				});

				// shared properties
				marker.bindTo("position", this);
				marker.bindTo("visible", this);

				// initialize icon
				marker.setIcon(icons(options.iconName));

				// initialize zIndex
				this.setLevel(this.get("level"));

				// set up events
				marker.addListener("click", function(){
					self.handleCustomEvent("click");
				});

				marker.addListener("mouseover", function(){
					if(self.get("iconHoverable")){
						self.lightUp();
						self.showLabel();
					}

					self.handleCustomEvent("mouseover");
				});

				marker.addListener("mouseout", function(){
					if(self.get("iconHoverable")){
						self.lightOut();
						self.hideLabel();
					}

					self.handleCustomEvent("mouseout");
				});

			}
			MarkerTooltip.prototype = new google.maps.OverlayView;

			MarkerTooltip.prototype.changed = function(property){
				var value = this.get(property);

				switch(property){
					case "position":
						return this.draw();
					case "iconName":
						return this.calculateOffset(), this.draw();
					case "caption":
						return this.modifyContent();
					case "level":
						return this.setLevel(value);
				}
			}
			MarkerTooltip.prototype.modifyContent = function(){
				//console.log("modifyContent");

				var tooltip = this.tooltip;
				if(!tooltip)	return;

				this.tooltipInner.textContent = this.get("caption");
				this.calculateOffset();
			}

			MarkerTooltip.prototype.handleCustomEvent = function(eventName){
				var eventsCalls = this.get("events");
				
				if(!eventsCalls || !eventsCalls[eventName])	return;

				// pass custom data to event handler
				eventsCalls[eventName](this.get("data"), this);
			}

			/**
			 * @override setMap
			 * @param {Map} map
			 */
			MarkerTooltip.prototype.setMap = function(map){
				google.maps.OverlayView.prototype.setMap.call(this, map);
				this.marker.setMap(map);
			}

			/**
			 * ==================================================
			 * @private
			 */
			MarkerTooltip.prototype.setLevel = function(level){
				var levels = {
					bottom:	1,
					common:	2,
					focus: 	3,
					top:   	4
				};

				if(!(level in levels))	return;
				this.marker.setZIndex(levels[level]);
			}

			MarkerTooltip.prototype.calculateOffset = function(){
				var MARKER_VERTIACL_MARGIN = 10;
			
				var markerIcon = this.marker.getIcon();
				if(!markerIcon){
					return this.set("offsetTop", 0);
				}else{
					return this.set("offsetTop", MARKER_VERTIACL_MARGIN + markerIcon.anchor.y);
				}
			}

			MarkerTooltip.prototype.onAdd = function(){
				// check if label previously showing
				if(this.get("isLabelShowing")){
					this.showLabel();
				}
			}

			MarkerTooltip.prototype.draw = function(){
				var projection = this.getProjection(),
					tooltip = this.tooltip,
					position = this.get("position");

				if(!projection || !tooltip || !position)	return;

				var screenPosition = projection.fromLatLngToDivPixel(position),
					offset = this.get("offsetTop");
				tooltip.style.left = screenPosition.x + "px";
				tooltip.style.top = screenPosition.y - offset + "px";
			}

			MarkerTooltip.prototype.onRemove = function(){
				//console.log("remove");

				var tooltip = this.tooltip;

				if(tooltip && tooltip.parentNode){
					tooltip.parentNode.removeChild(tooltip);
					delete this.tooltip;
					delete this.tooltipInner;
				}
			}

			/**
			 * ==================================================
			 * @public
			 */

			MarkerTooltip.prototype.setPosition = function(position){
				this.set("position", position instanceof google.maps.LatLng ?
					position : new google.maps.LatLng(position));
			}

			MarkerTooltip.prototype.showLabel = function(){
				if(!this.get("caption"))	return this;	// empty caption
				if(this.tooltip)        	return this;	// already showing

				// remember state in case marker has to wait for onAdd
				this.set("isLabelShowing", true);

				var panes = this.getPanes();
				if(!panes)	return this;	// panes not ready

				var tooltip = this.tooltip = document.createElement("div"),
					inner = this.tooltipInner = document.createElement("div");

				tooltip.appendChild(inner);

				tooltip.classList.add("marker-label");
				inner.classList.add("marker-label-inner");
				this.modifyContent();

				panes.floatPane.appendChild(tooltip);

				this.setLevel("focus");
				this.draw();

				return this;
			}

			MarkerTooltip.prototype.hideLabel = function(){
				if(!this.get("caption"))	return this;

				var tooltip = this.tooltip;

				if(!tooltip)	return this;

				this.setLevel(this.get("level"));
				this.onRemove();

				// reset state
				this.set("isLabelShowing", false);
				return this;
			}

			MarkerTooltip.prototype.lightUp = function(){
				this.marker.setIcon(icons(this.get("iconName"), true, isMiniMode()));

				return this;
			}

			MarkerTooltip.prototype.lightOut = function(){
				this.marker.setIcon(icons(this.get("iconName"), false, isMiniMode()));

				return this;
			}

			MarkerTooltip.prototype.setIcon = function(iconName, hoverState){
				if(iconName){
					this.marker.setIcon(icons(iconName, !!hoverState, this.get("supportsMini") && isMiniMode()));
					this.set("iconName", iconName);
				}
				return this;
			}

			MarkerTooltip.prototype.setMarkerOpacity = function(finalOpacity){
				var self = this;

				var onGoingAnimation = this.get("onGoingAnimation");
				if(onGoingAnimation)	onGoingAnimation.stop();

				onGoingAnimation = $({value: self.marker.getOpacity()}).animate({
					value: finalOpacity
				}, {
					duration: 100,
					step: function(){
						self.marker.setOpacity(this.value);
					},
					complete: function(){
						self.marker.setOpacity(this.value);
					}
				});

				this.set("onGoingAnimation", onGoingAnimation);
			}

			MarkerTooltip.prototype.center = function(zoomLevel){
				var map = manager.map, self = this;

				if(zoomLevel)	map.setZoom(zoomLevel);


				// Add to the end of execution queue
				setTimeout(function(){
					var span = map.getBounds().toSpan();
					var position = self.get("position");

					// responsive!
					if(smallScreen){
						map.panTo({
							lat: position.lat(), lng: position.lng()
						});
					}else{
						map.panTo({
							lat: position.lat(), lng: position.lng() - span.lng() * 0.25
						});
					}
				});

				return this;
			}

			var delayedCenter = delayedCall(500, function(marker){
				if(!manager.dragging)	marker.center();
			});
			MarkerTooltip.prototype.delayedCenter = function(){
				delayedCenter.call(this);
				return this;
			};
			MarkerTooltip.prototype.cancelDelayedCenter = function(){
				delayedCenter.cancel();
				return this;
			}

			MarkerTooltip.prototype.moveIntoBound = function(){
				var map = manager.map, self = this;

				var bounds = map.getBounds(),
					sw = bounds.getSouthWest(),
					ne = bounds.getNorthEast();
				var halfBounds = new google.maps.LatLngBounds({
					lat: sw.lat(),
					lng: sw.lng() + bounds.toSpan().lng() * 0.5
				}, ne);
				var targetLatLng = this.get("position");
				if(!halfBounds.contains(targetLatLng)){
					this.center();
				}

				return this;
			}

			MarkerTooltip.prototype.show = function(){
				this.setMap(map);
				this.set("isHiding", false);
			}

			MarkerTooltip.prototype.hide = function(){
				this.setMap(null);
				this.set("isHiding", true);
			}


			function MarkerSet(set_id){
				this.set_id = set_id;
				this.markers = {};
				this.isHiding = false;
			}
			MarkerSet.prototype.setMarker = function(marker_id, marker){
				this.markers[marker_id] = marker;
				return marker;
			}
			MarkerSet.prototype.getMarker = function(marker_id){
				var marker = this.markers[marker_id];
				if(!marker)	return null;
				else       	return marker;
			}
			MarkerSet.prototype.empty = function(){
				this.markers = {};
				return this;
			}
			MarkerSet.prototype.show = function(){
				this.isHiding = false;
				for(var marker_id in this.markers){
					this.markers[marker_id].show();
				}
			}
			MarkerSet.prototype.hide = function(){
				this.isHiding = true;
				for(var marker_id in this.markers){
					this.markers[marker_id].hide();
				}
			}


			manager.map = map;
			manager.ready = true;
			manager.MarkerTooltip = MarkerTooltip;
			manager.MarkerSet = MarkerSet;

			// set up events
			map.addListener("dragstart", function(){
				manager.dragging = true;
			});
			map.addListener("dragend", function(){
				manager.dragging = false;
			});
			map.addListener("idle", function(){
				var bounds = map.getBounds(),
					sw = bounds.getSouthWest(),
					ne = bounds.getNorthEast();
				var eastBounds = new google.maps.LatLngBounds({
						lat: sw.lat() - bounds.toSpan().lat(),
						lng: sw.lng() + bounds.toSpan().lng() * 0.5
					}, {
						lat: ne.lat() + bounds.toSpan().lat(),
						lng: ne.lng() + bounds.toSpan().lng()
					}),
					westBounds = new google.maps.LatLngBounds({
						lat: sw.lat() - bounds.toSpan().lat(),
						lng: sw.lng() - bounds.toSpan().lng()
					}, {
						lat: ne.lat() + bounds.toSpan().lat(),
						lng: ne.lng() - bounds.toSpan().lng() * 0.5
					});

				// hide markers when not in 2x viewport, reduce opacity when in 
				// the left side of screen
				for(var set_id in marker_sets){
					var set = marker_sets[set_id];

					// skip enitre set if set is set to hidden
					if(set.isHiding)	continue;

					for(var marker_id in set.markers){
						var marker = set.markers[marker_id];

						if(marker.get("isHiding"))	continue;

						var targetLatLng = marker.get("position");

						if(smallScreen){
							// markers don't need to be dimmed in mobile layout
							if(bounds.contains(targetLatLng)){
								//if(marker.get("isHiding")){
									if(!marker.getMap())	marker.setMap(map);
									//marker.set("isHiding", false);
									//marker.showLabel();
								//}
							}else{
								//if(!marker.get("isHiding")){
									marker.setMap(null);
									//marker.set("isHiding", true)
									//marker.hideLabel();
								//}
							}
						}else{
							// large screens
							if(eastBounds.contains(targetLatLng)){
								//if(marker.get("isHiding")){
									if(!marker.getMap())	marker.setMap(map);
									//marker.set("isHiding", false);
								//}
								marker.setMarkerOpacity(1);
							}else if(westBounds.contains(targetLatLng)){
								//if(marker.get("isHiding")){
									if(!marker.getMap())	marker.setMap(map);
									//marker.set("isHiding", false);
								//}
								marker.setMarkerOpacity(0.2);
							}else{
								//if(!marker.get("isHiding")){
									marker.setMap(null);
									//marker.set("isHiding", true);
								//}
							}
						}
					}
				}

			});

			// set up automatic mini mode icon
			var previousIsMini = isMiniMode();
			var zoomChangedDelayedCallback = delayedCall(300, function(){
				var currentIsMini = isMiniMode();

				if(currentIsMini !== previousIsMini){
					// update icons
					for(var set_id in marker_sets){
						var set = marker_sets[set_id];
						for(var marker_id in set.markers){
							var marker = set.markers[marker_id];
							marker.setIcon(marker.get("iconName"), false);
						}
					}
					previousIsMini = currentIsMini;
				}
			});
			map.addListener("zoom_changed", zoomChangedDelayedCallback.call);
		}


		var marker_sets = {};

		var commands = {
			getSet: function(set_id){
				var set = marker_sets[set_id];
				if(!set)	return null;

				return set;
			},
			addSet: function(set_id){
				var set = marker_sets[set_id];
				if(!set)	set = marker_sets[set_id] = new manager.MarkerSet(set_id);

				return set;
			},
			getMarker: function(set_id, marker_id){
				var set = commands.getSet(set_id);
				if(!set)	return null;

				var marker = set.getMarker(marker_id);
				if(!marker)	return null;

				return marker;
			},
			setMarker: function(set_id, marker_id, marker){
				return commands.addSet(set_id).setMarker(marker_id, marker);
			},
			getAndCreateMarker: function(set_id, marker_id, options){
				var marker = commands.getMarker(set_id, marker_id);
				if(!marker){
					marker = commands.createMarker(options);
					commands.setMarker(set_id, marker_id, marker);
				}

				return marker;
			},
			createMarker: function(options){
				//console.log("creating", manager.MarkerTooltip);
				return new manager.MarkerTooltip(options, manager.map);
			}
		};

		var manager = {
			proccessQueue: [],
			ready: false,
			map: undefined,
			loaded: function(callback){
				if(manager.ready)	callback(manager.commands);
				else{
					manager.proccessQueue.push(function(){
						callback(manager.commands);
					});
				}
			},
			load: function(element, options, onLoadPromise){
				var deferred = $q.defer();

				if(!isLoaded){
					if(typeof google === "undefined"){
						// offline
						deferred.reject();
						return deferred.promise;
					}

					var map = new google.maps.Map(element, options);

					// add listener to run when the map is loaded
					google.maps.event.addListenerOnce(map, "idle", function(){
						isLoaded = true;
						setup(map);

						var p = onLoadPromise(manager.commands) || $q.resolve();

						p.then(function(){
							manager.proccessQueue.forEach(function(proccess){ proccess(); });
							manager.proccessQueue = [];
							deferred.resolve();
						});
					});
				}

		        return deferred.promise;
			},
			sets: marker_sets,
			commands: commands,
			dragging: false
		};

		window.manager = manager;
		return manager;
	})

	.service("Transit", function Transit($q, $interval, geolocation, SampleAdapter, ChampaignTransitAdapter){

		// temporary
		var Adapter = ChampaignTransitAdapter;
		var cachedStops;

		function inherit(child, parent){
			child.prototype = Object.create(parent.prototype);
			child.prototype.constructor = child;
		}

		function applyDefault(preset, input){
			for(var key in input){
				preset[key] = input[key];
			}
			return preset;
		}

		function Entity(){}
		/** Implements .set */
		Entity.prototype.set = function(input, value){
			if(typeof input === "string"){
				this[input] = value;
			}else if(typeof input === "object"){
				for(var key in input){
					if(input.hasOwnProperty(key))
						this[key] = input[key];
				}
			}
		};

		/**
		 * A generic type for observable
		 * @param {String} id
		 */
		function Observable(id){
			this.set({
				id: String(id),
				observers: [],
				updatePromise: undefined
			});
		}
		inherit(Observable, Entity);
		/** Implements .observe */
		Observable.prototype.observe = function(fn){
			function doUpdate(){
				self.update().then(function(rtn){
					self.observers.forEach(function(observer){
						observer.call(self, rtn);
					});
				}, function(){
					console.warn("Failed to update " + self.constructor.name);
				});
			}

			var self = this;

			// add observer to observers list
			this.observers.push(fn);

			// create timer, executes every 1 minute
			if(!this.updatePromise){
				this.updatePromise = $interval(doUpdate, 1000 * 60);
			}
		};
		/** Implements .clearObserve */
		Observable.prototype.clearObserve = function(){
			// reset list
			this.observers = [];

			// cancel any ongoing timer
			$interval.cancel(this.updatePromise);

			// clear promise
			this.updatePromise = undefined;
		}
		/** Implements .update, returns a promise */
		Observable.prototype.update = function(){
			return $q.reject();
		};


		/**
		 * An unordered set of stops
		 * @param {[Array]} stops A description of stops
		 */
		function StopsSet(stops){
			this.stops = Object.create(null);
			
			var self = this;

			if(Array.isArray(stops)){
				stops.forEach(function(stop){
					self.add(stop);
				});
			}
		}
		inherit(StopsSet, Entity);
		StopsSet.prototype.add = function(stop){
			this.stops[stop.id] = Stop.toStop(stop);
		};
		StopsSet.prototype.remove = function(stop){
			if(stop)	delete this.stops[stop.id];
		};
		StopsSet.prototype.getList = function(){
			var stops = [];
			for(var id in this.stops){
				// no need for .hasOwnProperty check
				// this.stops is inherited from null
				stops.push(this.stops[id]);
			}
			return stops;
		};
		StopsSet.prototype.getRecursiveList = function(){
			var stops = this.getList();
			for(var id in this.stops){
				stops = stops.concat(this.stops[id].substops.getRecursiveList());
			}
			return stops;
		};
		StopsSet.prototype.getStop = function(id, level){
			level = level || 0;
			var parts = id.split(":");

			if(parts.length - 1 <= level)	return this.stops[id] || null;
			else {
				var stop = this.stops[parts.slice(0, level + 1).join(":")];
				return stop ? stop.substops.getStop(id, level + 1) : null;
			}
		};

		/**
		 * Describes a stop
		 * @param {String} id
		 * @param {Object} props Properties
		 */
		function Stop(id, props){
			this.set(applyDefault({
				id: id,
				rootId: id,
				name: "",
				fullname: "",
				location: {lat: 0, lng: 0},
				substops: []
			}, props));

			// construct actual StopsSets
			this.set("substops", new StopsSet(this.substops));
		}
		inherit(Stop, Entity);
		/** Get incoming departures of a stop. Returns a promise */
		Stop.prototype.getUpcomingDepartures = function(){
			/*
			return $q.all([Adapter.getUpcomingDepartures(this.id), exports.getAllStops()])
				.then(function(values){
					var departures = values[0], stops = values[1];

					return departures.map(function(departure){
						departure.bus.origin = stops.getStop(departure.bus.origin);
						departure.bus.destination = stops.getStop(departure.bus.destination);
						departure.bus = new Bus(departure.bus.id, departure.bus);

						return departure;
					});
				});
				*/
			return new DeparturesList(this.id).update();
		};
		Stop.toStop = function(obj){
			if(obj instanceof Stop)	return obj;
			if(!obj)               	return null;
			else                   	return new Stop(obj.id, obj);
		};


		function DeparturesList(id){
			Observable.call(this, id);

			this.set("departures", []);
		}
		inherit(DeparturesList, Observable);
		DeparturesList.prototype.update = function(){
			var self = this;

			return $q.all([exports.getAllStops(), Adapter.getUpcomingDepartures(this.id)])
				.then(function(values){
					var stops = values[0], departures = values[1];

					// build object from literals
					departures.forEach(function(departure){
						departure.origin = stops.getStop(departure.origin);
						departure.destination = stops.getStop(departure.destination);
						departure.bus = new Bus(departure.bus.id, departure.bus);
					});

					self.set("departures", departures);
					return self;
				});
		};


		/**
		 * A description of a bus
		 * @param {string} id
		 * @param {Object} props Initial properties
		 */
		function Bus(id, props){
			Observable.call(this, id);

			this.set(applyDefault({
				headsign: "",
				location: {
					lat: 0,
					lng: 0
				},
				routeId: "",
				pathId: "",
				routeColor: "#fff300"
			}, props));
		}
		inherit(Bus, Observable);
		Bus.prototype.update = function(){
			var self = this;

			return Adapter.getBusInformation(this.id).then(function(bus_info){
				self.set(bus_info);

				return self;
			});
		};
		Bus.prototype.getCurrentRoute = function(){
			if(!this.pathId)	return null;

			return $q.all([
				Adapter.getPathById(this.pathId),
				Adapter.getStopsInPath(this.pathId)
			]).then(function(values){
				var path = values[0], stops = values[1];
				return {
					path: path,
					stops: stops.map(function(id){ return id.split(":")[0]; })
				};
			});
		};


		var app = {
			getAllStopsOngoingPromise: undefined
		};

		var exports = {
			/** Get all stops */
			getAllStops: function(){
				// if there exists an ongoing promise, it shouldn't make another request.
				// instead it should wait on the previous one.
				if(app.getAllStopsOngoingPromise)	return app.getAllStopsOngoingPromise;

				// create promise
				var deferred = $q.defer();

				// data is cached already
				if(cachedStops){
					deferred.resolve(cachedStops);
					return deferred.promise;
				}

				var promise = Adapter
					.getAllStops()
					.then(function(stops_data){
						// clear ongoing promise
						app.getAllStopsOngoingPromise = undefined;

						return cachedStops = new StopsSet(stops_data);
					});

				return app.getAllStopsOngoingPromise = promise;
			},
			/** Get stops that match input id */
			getStop: function(stopId, allMatches){
				return exports
					.getAllStops()
					.then(function(stops){
						var stop = stops.getStop(stopId);
						if(!stop)	throw "Cannot find stop \"" + stopId + "\"";

						if(allMatches)	return [stop].concat(stop.substops.getRecursiveList());	// get all matches
						else          	return stop;                                           	// get best match
					});
			},
			/** Get stops near user location */
			getNearbyStops: function(){
				var promise = 
					// get user location
					geolocation()
					// get all stops and nearby stop ids
					.then(function(location){
						return $q.all([
							exports.getAllStops(),
							Adapter.getStopsByLocation({lat: location.latitude, lng: location.longitude})
						]);
					})
					// return stops
					.then(function(values){
						var stops = values[0];

						return values[1].map(function(stopId){
							return stops.getStop(stopId);
						});
					});

				return promise;
			},
			/** Get stops that best match input string */
			searchStops: function(input){
				if(!input){
					// empty string
					return $q.resolve([]);
				}else{
					// search
					return $q.all([exports.getAllStops(), Adapter.searchStops(input)]).then(function(values){
						var stops = values[0], matchedStops = values[1];
						return matchedStops.map(function(stopId){
							return stops.getStop(stopId);
						});
					});
				}
			},
			/** Get bus information by bus id */
			getBusInformation: function(busId){
				return Adapter.getBusInformation(busId).then(function(bus_data){
					return new Bus(bus_data.id, bus_data); 
				});
			},
			/** Get config */
			getConfig: function(){
				return Adapter.getConfig();
			},
		};

		window.Transit = exports;

		return exports;
	})

	.service("ChampaignTransitAdapter", function ChampaignTransitAdapter($q, $http, storage, getShapeAndStops, ROUTE_COLORS){
		var key = "77b92e5ceef640868adfc924c1735ac3";

		var AngularPromise = $q.resolve().constructor;

		var dataCache = {
			/*
				This cache will store either an Angular Promise or an object
				consisting data. When a Promise is stored, the corresponding
				request is ongoing and should not initiate another request.
			 */
			cache: {},
			get: function(method, data){
				return this.cache[method + JSON.stringify(data)];
			},
			set: function(method, data, rtn){
				this.cache[method + JSON.stringify(data)] = rtn;
				console.log(this.cache);
				return rtn;
			}
		};
		function getData(method, data, onlyFetchOnce){
			console.log("[getData]", method, data, onlyFetchOnce);

			if(data === undefined)	data = {};	// default object

			if(onlyFetchOnce){
				var cachedData = dataCache.get(method, data);
				if(cachedData){
					if(cachedData instanceof AngularPromise)	return cachedData;

					console.log("[getData] Fetched %s from cache", method);
					return $q.resolve(cachedData);
				}
			}

			var rtnPromise = $http
			// initiate request
			.get("https://developer.cumtd.com/api/v2.2/json/" + method, {
				params: angular.extend({}, data, {key: key})
			})
			// data received
			.then(function(res){
				console.log("[getData] Server responded to %s with status %d", method, res.data.status.code);

				if(res.data.status.code !== 200)	return $q.reject(res.data.status.msg);
				else                            	return onlyFetchOnce ? dataCache.set(method, data, res.data) : res.data;
			}, function(res){
				return $q.reject(res.statusText);
			})
			// catch all errors
			.catch(function(errMsg){
				console.error("[" + method + "]", errMsg);

				return $q.reject(errMsg);
			});

			// store promise in case another there is another request when the previous one isn't done yet
			if(onlyFetchOnce)	dataCache.set(method, data, rtnPromise);

			return rtnPromise;
		}

		function getBaseRouteId(routeId){
			return routeId.toLowerCase().split(" ")[0];
		}

		var config = {
			dataProvider: {
				name: "CUMTD",
				link: "https://www.cumtd.com/"
			},
			defaultMapSettings: {
				// main quad
				location: {
					lat: 40.1069778,
					lng: -88.2272211
				},
				zoomLevel: 17
			}
		};
			

		return {
			getAllStops: function(){
				var storedData = storage.get("adapter_storage:Champaign") || {};
				
				return getData("GetStops", {
					changeset_id: storedData.changeset_id
				}).then(function(res){
					// no updates
					if(!res.new_changeset){
						return cachedStops = storedData.allStops;
					}

					// process update
					var stops = res.stops,
						output = [];

					stops.forEach(function(stop){
						var stopName = stop.stop_name,
							stopLocation = stop.stop_points.reduce(function(prev, stop_point){
								prev.lat += stop_point.stop_lat;
								prev.lng += stop_point.stop_lon;

								return prev;
							}, {lat: 0, lng: 0}),
							substops = [];

						stopLocation.lat /= stop.stop_points.length;
						stopLocation.lng /= stop.stop_points.length;

						output.push({
							id: stop.stop_id,
							rootId: stop.stop_id,
							name: stopName,
							fullname: stopName,
							location: stopLocation,
							substops: substops
						});

						// create separate entries for all substops
						stop.stop_points.forEach(function(stop_point){
							substops.push({
								id: stop_point.stop_id,
								rootId: stop.stop_id,
								name: stopName,
								fullname: stop_point.stop_name,
								location: {
									lat: stop_point.stop_lat,
									lng: stop_point.stop_lon
								},
								substops: []
							});
						});
					});

					storage.set("adapter_storage:Champaign", {
						allStops: output,
						changeset_id: res.changeset_id
					});

					return cachedStops = output;
				}).catch(function(){
					if(storedData.allStops)	return storedData.allStops;
					else                   	return $q.reject();
				});
			},
			getUpcomingDepartures: function(stopId){
				return getData("GetDeparturesByStop", {
					stop_id: stopId
				})
				.then(function(res){
					return res.departures.map(function(departure){
						return {
							stopId: stopId,
							expectedMinutes: departure.expected_mins,
							expectedTime: departure.expected,
							attributes: {
								"iStop": departure.is_istop,
								"scheduled": departure.is_scheduled
							},
							bus: {
								id: departure.vehicle_id,
								headsign: departure.headsign,
								location: {
									lat: departure.location.lat,
									lng: departure.location.lon
								},
								routeId: departure.trip.route_id,
								pathId: departure.trip.shape_id,
								routeColor: ROUTE_COLORS[getBaseRouteId(departure.trip.route_id)]
							},
							origin: departure.origin.stop_id,
							destination: departure.destination.stop_id,
							routeId: departure.route.route_id
						};
					})
				});
			},
			getStopsByLocation: function(location){
				var promise = getData("GetStopsByLatLon", {
						lat: location.lat,
						lon: location.lng,
						count: 20
					})
					.then(function(res){
						return res.stops.map(function(stop){ return stop.stop_id; });
					});

				return promise;
			},
			searchStops: function(input){
				return $http.get("https://www.cumtd.com/autocomplete/Stops/v1.0/json/search", {
					params: { query: input }
				})
				.then(function(res){
					return res.data.map(function(stop){
						// return stop id
						return stop.i;
					});
				});
			},
			getBusInformation: function(busId){
				return getData("GetVehicle", {
					vehicle_id:	busId
				}).then(function(res){
					var bus = res.vehicles[0];

					if(!bus)	throw undefined;

					return {
						id: busId,
						headsign: bus.trip ? bus.trip.trip_headsign : "",
						location: {
							lat: bus.location.lat,
							lng: bus.location.lon
						},
						routeId: bus.trip ? bus.trip.route_id : "",
						pathId: bus.trip ? bus.trip.shape_id : "",
						routeColor: bus.trip ? ROUTE_COLORS[getBaseRouteId(bus.trip.route_id)] : ""
					};
				})
			},
			getPathById: function(shapeId){
				return getData("getShape", {
					shape_id: shapeId
				}, true)
				.then(function(res){
					return res.shapes.map(function(point){
						return {
							lat: point.shape_pt_lat,
							lng: point.shape_pt_lon
						};
					});
				});
			},
			getStopsInPath: function(shapeId){
				return getData("getShape", {
					shape_id: shapeId
				}, true)
				.then(function(res){
					return res.shapes.filter(function(point){
						return point.stop_id;
					}).map(function(point){
						return point.stop_id;
					});
				});
			},
			getConfig: function(){
				return config;
			}
		};

	})

	.service("SampleAdapter", function ChampaignTransitAdapter($q){
		var config = {
			dataProvider: {
				name: "Sample Provider",
				link: "https://www.example.com/"
			},
			defaultMapSettings: {
				// main quad
				location: {
					lat: 41.8794471,
					lng: -87.6286177
				},
				zoomLevel: 17
			}
		};
			
		function getTimeAfterNMinutes(minutes){
			var time = new Date();
			time.setMinutes(time.getMinutes() + minutes);
			return time;
		}

		return {
			getAllStops: function(){
				return $q.resolve([{
					id: "1119",
					rootId: "1119",
					name: "Michigan & Randolph",
					fullname: "Michigan & Randolph",
					location: {
						lat: 41.8846829,
						lng: -87.6243509
					},
					substops: []
				}, {
					id: "1106",
					rootId: "1106",
					name: "Michigan & Washington",
					fullname: "Michigan & Washington",
					location: {
						lat: 41.8842248,
						lng: -87.6249312
					},
					substops: []
				}]);
			},
			getUpcomingDepartures: function(stopId){
				return this.getAllStops()
				.then(function(stops){
					var stop = stops.find(function(stop){ return stop.id === stopId; });
					if(stop){

						return [{
							stopId: stop.id,
							expectedMinutes: 3,
							expectedTime: getTimeAfterNMinutes(3).toISOString(),
							attributes: {
								"free": false
							},
							bus: {
								id: "0001",
								headsign: "3N",
								location: {
									lat: 41.880828,
									lng: -87.624457
								},
								pathId: "path_01"
							},
							origin: "1106",
							destination: "1119",
							routeId: "3"
						}];
					}else{
						return $q.reject();
					}
				});
			},
			getStopsByLocation: function(location){
				return this.getAllStops()
				.then(function(stops){
					return stops.map(function(stop){ return stop.id; });
				});
			},
			searchStops: function(input){
				input = input.toLowerCase();

				return this.getAllStops().then(function(stops){
					return stops.filter(function(stop){
						return stop.fullname.toLowerCase().indexOf(input) > -1;
					}).map(function(stop){
						return stop.id;
					});
				});
			},
			getBusInformation: function(busId){
				if(busId === "0001"){
					return $q.resolve({
						id: "0001",
						headsign: "3N",
						location: {
							lat: 41.880828,
							lng: -87.624457
						},
						pathId: "path_01"
					});
				}else{
					return $q.reject();
				}
			},
			getPathById: function(shapeId){
				return $q.reject();
			},
			getConfig: function(){
				return config;
			}
		};

	})

}