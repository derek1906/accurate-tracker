function services(tracker){
	tracker
	.service("storage", function(){
		var methods = {
			exists: function(key){
				return localStorage[key] !== undefined;
			},
			get: function(key){
				return JSON.parse(localStorage[key]);
			},
			set: function(key, value){
				localStorage[key] = JSON.stringify(value);
			}
		};

		return methods;
	})
	.service("loadStopsDetails", function($q, stop_details, storage, getData){
		var DATA_STORAGE_KEY = "stop_data";
		return function(){
			var deferred = $q.defer();

			if(storage.exists(DATA_STORAGE_KEY) && !stop_details.loaded){
				stop_details.stops = storage.get(DATA_STORAGE_KEY).stops;
				stop_details.loaded = true;

				deferred.resolve();
			}
			if(!storage.exists(DATA_STORAGE_KEY) || storage.get(DATA_STORAGE_KEY).last_updated - Date.now() > 7*24*60*60*1000){
				console.log("outdated")
				getData("GetStops").then(
					function(res){
						var stops = {};
						res.stops.forEach(function(e){
							stops[e.stop_id] = e;
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
	.service("getData", function($q, $http){
		var key = "77b92e5ceef640868adfc924c1735ac3";

		return function(method, data){
			var deferred = $q.defer();

			if(data === undefined)	data = {};
			data.key = key;
			data.callback = "JSON_CALLBACK";
			$http.jsonp("http://developer.cumtd.com/api/v2.2/json/" + method, {
				params: data
			})
				.then(function(res){
					deferred.resolve(res.data);
				}, function(){
					deferred.reject([]);
				});

			return deferred.promise;
		};
	})
	.service("getNearbyStops", function($q, getData){
		return function(count){
			var deferred = $q.defer();
			var data = {};

			if(count != undefined)	data.count = count;

			navigator.geolocation.getCurrentPosition(function(pos){
				data.lat = pos.coords.latitude;
				data.lon = pos.coords.longitude;

				getData("GetStopsByLatLon", data)
					.then(function(res){
						deferred.resolve(res.stops);
					}, function(){
						deferred.reject([]);
					});
			});

			return deferred.promise;
		}
	})
	.service("getUpcomingBuses", function($q, getData){
		return function(id){
			var deferred = $q.defer();

			getData("GetDeparturesByStop", {
				stop_id: id
			})
				.then(function(res){
					deferred.resolve(res.departures);
				}, function(){
					deferred.reject();
				});

			return deferred.promise;
		};
	})
}