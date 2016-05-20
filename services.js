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
			home: {
				url: "icons/map_icon_set.png",
				size: {width: 74, height: 88},
				origin: {x: 0, y: 0}
			},
			stop: {
				url: "icons/map_icon_set.png",
				size: {width: 62, height: 73},
				origin: {x: 0, y: 88}
			},
			bus: {
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
				deferred.resolve();
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
						deferred.resolve();

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

						deferred.resolve("updated");
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

	.service("MapComponentManager", function MapComponentManager(uiGmapIsReady, uuid, icons){
		/**
		 * Location class
		 * @param {Number} latitude  Latitude of location
		 * @param {Number} longitude Longitude of location
		 */
		function Location(latitude, longitude){
			if(typeof arguments[0] === "object"){
				this.latitude = arguments[0].latitude;
				this.longitude = arguments[0].longitude;
			}else{
				this.latitude = latitude;
				this.longitude = longitude;
			}
		}

		var universalIdKey = 1;

		/**
		 * Marker class
		 * @param {String} id        Unique id
		 * @param {Number} latitude  Latitude
		 * @param {Number} longitude Longitude
		 * @param {MarkerOptions} options   Follow MarkerOptions specification
		 */
		function Marker(id, prefs, options){
			if(id === undefined)	throw "id is required for creating a marker.";
			prefs = angular.extend({
				latitude: 0,
				longitude: 0,
				canIconHover: false,
				iconName: "",
				on: {}
			}, prefs);

			options = angular.extend({
				icon: icons(prefs.iconName)
			});

			var self = this;

			this.idKey = universalIdKey++;

			this.id = id;
			this.prefs = prefs;
			this.options = options;

			this.setLocation(prefs.latitude, prefs.longitude);
			delete prefs.latitude;
			delete prefs.longitude;

			this.events = {
				mouseover: function(){
					if(prefs.canIconHover)	self.lightUp();
					if(prefs.on.mouseover)	prefs.on.mouseover(self);
				},
				mouseout: function(){
					if(prefs.canIconHover)	self.lightOut();
					if(prefs.on.mouseout) 	prefs.on.mouseout(self);
				},
				click: function(){
					if(prefs.on.click)	prefs.on.click(self);
				}
			};
		}
		/**
		 * Add self to global list
		 */
		Marker.prototype.addSelf = function(){
			map.markers.push(this);
		}
		/**
		 * Remove self from global list
		 */
		Marker.prototype.removeSelf = function(){
			map.markers.splice(map.markers.indexOf(this), 1);
		}
		/**
		 * Set location
		 * @param {Number} latitude  Latitude
		 * @param {Number} longitude Longitude
		 * @return {Marker} Marker
		 */
		Marker.prototype.setLocation = function(latitude, longitude){
			this.location = new Location(latitude, longitude);
			return this;
		}
		/**
		 * Set icon
		 * @param {String} name Icon name
		 * @return {Marker} Marker
		 */
		Marker.prototype.setIcon = function(name){
			this.options.icon = icons(name);
			return this;
		}
		/**
		 * Set visibility for a marker
		 * @param {Boolean} visible Visibilility
		 * @return {Marker} Marker
		 */
		Marker.prototype.setVisible = function(visible){
			this.options.visible = visible;
			return this;
		};
		/**
		 * Center marker
		 * @return {Marker} Marker
		 */
		Marker.prototype.center = function(){
			manager.setCenter(this.location);
			return this;
		}
		Marker.prototype.lightUp = function(){
			this.options.icon = icons(this.prefs.iconName, true);
			return this;
		}
		Marker.prototype.lightOut = function(){
			this.options.icon = icons(this.prefs.iconName, false);
			return this;
		}

		/**
		 * Set class
		 * @param {String} id Unique id
		 */
		function Set(id){
			this.id = id;
			this.markers = [];
			this.visible = true;

			if(manager.isSetExist(id)){
				manager.getSetById(id).removeSelf();
			}
			this.addSelf();
		}
		/**
		 * Add a marker to a set
		 * @param {Marker} marker Marker to be added
		 */
		Set.prototype.addMarker = function(marker){
			marker.addSelf();
			this.markers.push(marker);
		}
		/**
		 * Add an array of markers to a set
		 * @param {Marker[]} markers An array of markers
		 */
		Set.prototype.addMarkers = function(markers){
			var self = this;

			this.markers = this.markers.concat(markers);
			markers.forEach(function(marker){
				marker.addSelf();
			});
		};
		Set.prototype.getMarkerById = function(marker_id){
			for(var i = 0; i < this.markers.length; i++){
				if(this.markers[i].id == marker_id){
					return this.markers[i];
				}
			}
			return undefined;
		};
		Set.prototype.removeMarker = function(marker){
			marker.removeSelf();
			this.markers.splice(this.markers.indexOf(marker), 1);
		};
		Set.prototype.addSelf = function(){
			map.marker_sets[this.id] = this;
		}
		Set.prototype.removeSelf = function(){
			this.markers.forEach(function(marker){
				marker.removeSelf();
			});
			delete map.marker_sets[this.id];
		}
		/**
		 * Set the visibility of a set
		 * @param {Boolean} visible Set visibility for all markers in a set
		 */
		Set.prototype.setVisible = function(visible){
			this.visible = visible;
			this.markers.forEach(function(marker){
				marker.setVisible(visible);
			});
		};


		// All actions to the map should go through getMap
		function getMap(callback){
			function execute(){
				if(map.control){
					callback(map.control.getGMap());
				}
			}

			if(map.ready)	execute();
			else         	map.proccessQueue.push(execute);
		}

		// Prcoess actions when map is loaded
		uiGmapIsReady.promise().then(function(){
			map.ready = true;
			map.proccessQueue.forEach(function(proccess){ proccess(); });
			map.proccessQueue = [];
		});


		var map = {
			marker_sets: {},
			markers: [],
			control: undefined,
			ready: false,
			proccessQueue: []
		};

		var manager = {
			/**
			 * Recieve control and return marker list reference for binding
			 * @param {Object} control uiGMap control object
			 * @return {Array} Maker list reference
			 */
			setControl: function(control){
				map.control = control;
				return map.markers;
			},

			/**
			 * Return true if set exists
			 * @param  {String}  set_id Set id
			 * @return {Boolean}        True if set exists
			 */
			isSetExist: function(set_id){
				return map.marker_sets[set_id] !== undefined;
			},
			/**
			 * Remove a set by id
			 * @param  {String} set_id id for the set to be removed
			 * @return {Boolean}        True if the set can be removed
			 */
			removeSetById: function(set_id){
				if(this.isSetExist(set_id)){
					delete map.marker_sets[set_id];
					return true;
				}
				return false;
			},
			/**
			 * Get a set by id
			 * @param  {String} set_id Set id
			 * @return {Set}        Set
			 */
			getSetById: function(set_id){
				return map.marker_sets[set_id];
			},
			/**
			 * Get a marker by set id and marker id
			 * @param  {String} set_id    Set id
			 * @param  {String} marker_id Marker id
			 * @return {Marker}           Marker
			 */
			getMarker: function(set_id, marker_id){
				var set = this.getSetById(set_id);
				return set ? set.getMarkerById(marker_id) : undefined;
			},
			/**
			 * Return marker by set id and marker id. Create if marker does not exist.
			 * 
			 * @param  {String} set_id    Set id
			 * @param  {String} marker_id Marker id
			 * @return {Marker}           Marker
			 */
			getAndCreateMarker: function(set_id, marker_id, default_marker){
				var set = this.getSetById(set_id);
				if(!set){
					set = new Set(set_id);
				}

				var marker = set.getMarkerById(marker_id);
				if(!marker){
					marker = default_marker;
					set.addMarker(marker);
				}

				return marker;
			},


			/**
			 * Set the "center" of the map
			 * @param {Object} location [description]
			 */
			setCenter: function(location){
				getMap(function(gmap){
					var span = gmap.getBounds().toSpan();

					// Add to the end of execution queue
					setTimeout(function(){
						gmap.panTo({
							lat: location.latitude,
							lng: location.longitude - span.lng() * 0.25
						})
					});
				})
			},

			// Exposing classes
			Set: Set,
			Marker: Marker,
			Location: Location,

			// Internal data
			map: map
		};
		window.manager = manager;

		return manager;
	});
}