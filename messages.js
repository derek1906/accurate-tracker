function messages(tracker){
	var messages = {
		"landing": {
			"default-title": {
				funny: ["Near as fuck."],
				standard: "Not far away."
			},
			"default-subtitle": {
				funny: ["These are the closest bus stops I could find."],
				standard: "These are the closest bus stops relative to your position."
			}
		},
		"stop-details": {
			"default-title": {
				funny: ["Don't miss it."],
				standard: "Don't miss it."
			},
			"default-subtitle": {
				funny: ["Use the damn timer so you won’t miss yo bus!"],
				standard: "Use the timer to remind yourself when a bus is arriving."
			}
		}
	};

	tracker
	.filter("msg", function(storage){
		var useStandard = storage.get("standard_messages");

		return function(message_id, page_id){

			var page = messages[page_id];
			if(!page)	return "[Message Error]";

			var message = page[message_id];
			if(!message)	return "[Message Error]";

			return useStandard ? message.standard : message.funny[Math.random()*message.funny.length |0];
		};
	})
}