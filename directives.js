function directives(tracker){
	tracker

	// Message directive
	.directive("msg", function(storage, random, $http){
		var useStandard = storage.get("standard_messages");
		var MESSAGE_ERROR_TEXT = "[Message Error]";

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

				if(attr.msgPageId){
					page_id = attr.msgPageId;
				}

				messagePromise.then(function(messages){
					scope.message = lookup(messages.data, page_id, message_id);
				}, function(){
					scope.message = MESSAGE_ERROR_TEXT;
				});
			}
		};
	})


	// Favorite button directive
	.directive("favButton", function(storage){
		// cache list to avoid repeated parsing
		var favoritesListCache = storage.get("favorites");

		return {
			restrict: "E",
			scope: true,
			template: '<md-button class="md-icon-button" ng-click="toggleFavorite()" aria-label="Toggle favorite">\
							<md-tooltip md-direction="left" md-delay="1000">{{tooltipMessage}}</md-tooltip>\
							<md-icon ng-show="favorited" md-svg-src="icons/heart.svg"></md-icon>\
							<md-icon ng-show="!favorited" md-svg-src="icons/emptyheart.svg"></md-icon>\
						</md-button>',
			link: function(scope, element, attr){
				var stopId = attr.stopId;

				scope.favorited = favoritesListCache.indexOf(stopId) > -1;
				setTooltipMessage();

				scope.toggleFavorite = function(){
					if(scope.favorited){
						// remove from favorite
						favoritesListCache.splice(favoritesListCache.indexOf(stopId), 1);
					}else{
						// add to favorite
						favoritesListCache.push(stopId);
					}

					// update storage
					storage.set("favorites", favoritesListCache);
					console.log(favoritesListCache)

					// update state
					scope.favorited = !scope.favorited;
					setTooltipMessage();
				};

				function setTooltipMessage(){
					scope.tooltipMessage = scope.favorited ? "cancel favorite" : "set favorite";
				};
			}
		}
	})
}
