function messages(tracker){
	var MESSAGE_ERROR_TEXT = "[Message Error]";

	tracker.directive("msg", function(storage, random, $http){
		var useStandard = storage.get("standard_messages");

		// fetch english messages
		var messagePromise = $http.get("i18n/en.json");

		function lookup(messages, page_id, message_id){
			var page = messages[page_id];
			if(!page)	return MESSAGE_ERROR_TEXT;

			var message = page[message_id];
			if(!message)	return MESSAGE_ERROR_TEXT;

			return useStandard ? message.standard : message.funny[random()*message.funny.length |0];
		}

		return {
			restrict: "A",
			template: "{{message}}",
			scope: true,
			link: function(scope, element, attr){
				var message_id = attr.msg;
				var page_id = element.controller().constructor.name;

				messagePromise.then(function(messages){
					scope.message = lookup(messages.data, page_id, message_id);
				}, function(){
					scope.message = MESSAGE_ERROR_TEXT;
				});
			}
		};
	});
}
