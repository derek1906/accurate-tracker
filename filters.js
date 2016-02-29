function filters(tracker){
	tracker
	.filter("stopID", function(stop_details){
		return function(id){
			id = id.split(":")[0];
			return stop_details.stops[id].stop_name;
		};
	})
}