function services(tracker){
	tracker

	// Storage service
	.factory("storage", function storage(){
		var methods = {
			exists: function(key){
				return localStorage[key] !== undefined;
			},
			get: function(key){
				return JSON.parse(localStorage[key]);
			},
			set: function(key, value){
				localStorage[key] = JSON.stringify(value);
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
			$rootScope.$broadcast("map", {action: action, data: data});
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
	.service("icons", function icons(uiGmapIsReady){
		var icons = {
			"home": {
				url: "icons/map_icon_set.png",
				size: {width: 74, height: 88},
				origin: {x: 0, y: 0}
			},
			"stop": {
				url: "icons/map_icon_set.png",
				size: {width: 62, height: 73},
				origin: {x: 0, y: 88}
			},
			"bus": {
				url: "icons/map_icon_set.png",
				size: {width: 70, height: 83},
				origin: {x: 0, y: 161}
			}
		}, icons_hover = {};

		for(var key in icons){
			var icon = icons[key];
			icon.anchor = {x: icon.size.width/2, y: icon.size.height};

			var icon_hover = icons_hover[key] = angular.copy(icon);
			icon_hover.origin.x += icon.size.width;
		}

		return function (name, isHover){
			if(!name)       	return undefined;
			if(!icons[name])	throw "Icon \"" + name + "\" does not exist.";
			else            	return isHover ? icons_hover[name] : icons[name];
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
					deferred.reject();
				});
			}

			return deferred.promise;
		}
	})

	// Handle communications to the API server
	.service("getData", function getData($q, $http){
		var key = "77b92e5ceef640868adfc924c1735ac3";

		return function(method, data){
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

	// Get stop details from database
	.service("getStopDetails", function getStopDetails(stop_details){
		return function(stop_id){
			var parts = stop_id.split(":");
			if(parts.length == 2){
				return stop_details.stops[parts[0]].stop_points.filter(function(stop){
					return stop.stop_id == stop_id;
				})[0];
			}else{
				return stop_details.stops[stop_id];
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

	.service("MapComponentManager", function MapComponentManager(uiGmapIsReady, icons, $q){

		uiGmapIsReady.promise().then(function(map){

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
			 */
			function MarkerTooltip(options, map){
				//console.log("Tooltip constructor", map);

				var self = this;
				var marker = this.marker = new google.maps.Marker();

				/*
				marker.changed = function(property){
					if(property == "icon"){
						self.calculateOffset();
					}
				}
				*/
			
				this.setValues({
					position: new google.maps.LatLng(options.position),
					visible: options.visible === undefined ? true : false,
					iconName: options.iconName,
					caption: options.caption,
					iconHoverable: options.iconHoverable === undefined ? false : true,
					events: options.events
				});

				// shared properties
				marker.bindTo("position", this);
				marker.bindTo("visible", this);

				// initialize icon
				marker.setIcon(icons(options.iconName));

				// set up events
				marker.addListener("click", function(){
					self.handleCustomEvent("click");
				});

				marker.addListener("mouseover", function(){
					var iconHoverable = self.get("iconHoverable");
					if(iconHoverable){
						marker.setIcon(icons(self.get("iconName"), true));
					}
					self.showLabel();

					self.handleCustomEvent("mouseover");
				});

				marker.addListener("mouseout", function(){
					var iconHoverable = self.get("iconHoverable");
					if(iconHoverable){
						marker.setIcon(icons(self.get("iconName"), false));
					}
					self.hideLabel();

					self.handleCustomEvent("mouseout");
				});


				// setMap
				this.setMap(map);
				marker.setMap(map);
			}
			MarkerTooltip.prototype = new google.maps.OverlayView;

			MarkerTooltip.prototype.changed = function(property){
				//console.log("Property changed: ", property, this.get(property));
				var value = this.get(property);

				switch(property){
					case "position":
						return this.draw();
					case "iconName":
						this.marker.setIcon(icons(this.get("iconName")));
						return this.calculateOffset();
					case "caption":
						return this.modifyContent();
				}
			}
			MarkerTooltip.prototype.modifyContent = function(){
				//console.log("modifyContent");

				var tooltip = this.tooltip;
				if(!tooltip)	return;

				tooltip.textContent = this.get("caption");
				this.calculateOffset();
			}

			MarkerTooltip.prototype.handleCustomEvent = function(eventName){
				var eventsCalls = this.get("events");
				
				if(!eventsCalls || !eventsCalls[eventName])	return;

				eventsCalls[eventName]();
			}

			MarkerTooltip.prototype.onAdd = function(){
				//console.log("onAdd");
			}

			MarkerTooltip.prototype.draw = function(){
				//console.log("draw");

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
				}
			}

			MarkerTooltip.prototype.setPosition = function(position){
				this.set("position", position instanceof google.maps.LatLng ?
					position : new google.maps.LatLng(position));
			}

			MarkerTooltip.prototype.showLabel = function(){
				var tooltip = this.tooltip = document.createElement("div");
				tooltip.style.position = "absolute";

				tooltip.classList.add("marker-label");
				this.modifyContent();

				var panes = this.getPanes();
				if(panes)	panes.mapPane.appendChild(tooltip);

				this.draw();
			}

			MarkerTooltip.prototype.hideLabel = function(){
				var tooltip = this.tooltip;

				if(!tooltip)	return;

				this.onRemove();
			}

			MarkerTooltip.prototype.calculateOffset = function(){
				var MARKER_VERTIACL_MARGIN = 10;
			
				var markerIcon = this.marker.getIcon();
				if(!markerIcon){
					return this.set("offsetTop", 0);
				}else{
					return this.set("offsetTop", markerIcon.size.height + MARKER_VERTIACL_MARGIN);
				}
			}

			MarkerTooltip.prototype.center = function(){
				var map = this.getMap(), self = this;

				var span = map.getBounds().toSpan();

				// Add to the end of execution queue
				setTimeout(function(){
					var position = self.get("position");
					map.panTo({
						lat: position.lat(),
						lng: position.lng() - span.lng() * 0.25
					});
				});
			}

			MarkerTooltip.prototype.moveIntoBound = function(){
				var map = this.getMap(), self = this;

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
			}


			function MarkerSet(set_id){
				this.set_id = set_id;
				this.markers = {};
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

			manager.map = map[0].map;
			manager.ready = true;
			manager.MarkerTooltip = MarkerTooltip;
			manager.MarkerSet = MarkerSet;

			manager.proccessQueue.forEach(function(proccess){ proccess(); });
			manager.proccessQueue = [];
		});


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
			map: map,
			loaded: function(callback){
				if(manager.ready)	callback(manager.commands);
				else{
					manager.proccessQueue.push(function(){
						callback(manager.commands);
					});
				}
			},
			sets: marker_sets,
			commands: commands
		};

		window.manager = manager;
		return manager;
	});
}