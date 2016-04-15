function services(tracker){
	tracker

	// Storage service
	.factory("storage", function(){
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
	.service("geolocation", function($q){
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
	.service("map", function($rootScope){
		return function(action, data){
			$rootScope.$broadcast("map", {action: action, data: data});
		};
	})

	.service("btn", function($rootScope){
		return function(action, data){
			$rootScope.$broadcast("overmapButtons", {action: action, data: data});
		}
	})

	// icons generator
	.service("icons", function(){
		var icons = {
			home: {
				url: "icons/home.png",
				size: {width: 35, height: 56}
			},
			stop: {
				url: "icons/stop.png",
				size: {width: 25, height: 39}
			}
		}
		return function(name){
			var icon = icons[name];
			if(!icon.anchor){
				icon.anchor = new google.maps.Point(icon.size.width/2, icon.size.height);
			}
			return icon;
		}
	})

	// Load stops database - Fetch from web if data is outdated or missing
	.service("loadStopsDetails", function(DATA_STORAGE_KEY, $q, stop_details, storage, getData){
		return function(){
			var deferred = $q.defer();

			if(storage.exists(DATA_STORAGE_KEY)){
				if(!stop_details.loaded){
					stop_details.stops = storage.get(DATA_STORAGE_KEY).stops;
					stop_details.loaded = true;
				}
				deferred.resolve();
			}
			if(!storage.exists(DATA_STORAGE_KEY) || storage.get(DATA_STORAGE_KEY).last_updated - Date.now() > 7*24*60*60*1000){
				console.log("[loadStopsDetails]", "Updating database.");
				getData("GetStops").then(
					function(res){
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
							last_updated: Date.now()
						});

						stop_details.stops = stops;
						stop_details.loaded = true;

						deferred.resolve("updated");
					}, function(){
						console.error("Cannot update");
						deferred.reject();
					});
			}

			return deferred.promise;
		}
	})

	// Handle communications to the API server
	.service("getData", function($q, $http){
		var key = "77b92e5ceef640868adfc924c1735ac3";

		return function(method, data){
			var deferred = $q.defer();
			console.log("[getData]", method, data);

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
	.service("getAutocomplete", function($q, $http, getStopDetails){
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
	.service("getNearbyStops", function($q, getData, geolocation, getStopDetails){
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
	.service("getUpcomingBuses", function($q, getData){
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
	.service("getStopDetails", function(stop_details){
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
	.factory("TripManager", function($q, getData){
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

	.service("getShapeAndStops", function($q, getData, getStopDetails){
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
	});
}