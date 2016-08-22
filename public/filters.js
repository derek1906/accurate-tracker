function filters(tracker){
	tracker
	.filter("stopID", function(stop_details, getStopDetails){
		return function(id){
			return getStopDetails(id).stop_name;
		};
	})

	.filter("toDate", function(){
		return function(str){
			var parts = str.split(":");

			var date = new Date();
			date.setHours(+parts[0]);
			date.setMinutes(+parts[1]);
			date.setSeconds(+parts[2]);

			return date;
		}
	});
}