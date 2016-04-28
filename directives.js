function directives(tracker){
	tracker

	// Message directive
	.directive("msg", function msg(storage, random, $http, $compile){
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
			link: function(scope, element, attr){
				var message_id = attr.msg;
				var page_id = element.controller().constructor.name;

				if(attr.msgPageId){
					page_id = attr.msgPageId;
				}

				messagePromise.then(function(messages){
					element.html(lookup(messages.data, page_id, message_id));

					// compile html string
					$compile(element.contents())(scope);
				}, function(){
					element.html(MESSAGE_ERROR_TEXT);
				});
			}
		};
	})


	// Favorite button directive
	.directive("favButton", function favButton(storage){
		// cache list to avoid repeated parsing and maintain consistency
		var favoritesListCache = storage.get("favorites");

		return {
			restrict: "E",
			scope: true,
			template:	'<md-button class="md-icon-button" ng-click="toggleFavorite()" aria-label="Toggle favorite">\
			         		<md-icon ng-show="favorited" md-svg-src="icons/heart.svg"></md-icon>\
			         		<md-icon ng-show="!favorited" md-svg-src="icons/emptyheart.svg"></md-icon>\
			         	</md-button>',
			link: function(scope, element, attr){

				var currentListener = function(){};

				// watch for changes on attribute
				attr.$observe("stopId", function(){
					if(attr.stopId){
						// cancel watch
						currentListener();
						// watch for changes on expression
						currentListener = scope.$watch(attr.stopId, function(){
							var stopId = scope.$eval(attr.stopId);

							scope.favorited = favoritesListCache.indexOf(stopId) > -1;
							setState();

							scope.toggleFavorite = function(){
								toggleFavorite(stopId);
							};
						});
					}
				});

				// toggle favorite
				function toggleFavorite(stopId){
					if(scope.favorited){
						// remove from favorite
						favoritesListCache.splice(favoritesListCache.indexOf(stopId), 1);
					}else{
						// add to favorite
						favoritesListCache.push(stopId);
					}

					// update storage
					storage.set("favorites", favoritesListCache);

					// update state
					scope.favorited = !scope.favorited;
					setState();
				}

				// update tooltip message
				function setState(){
					element[["addClass", "removeClass"][+scope.favorited]]("not-fav");
					scope.tooltipMessage = scope.favorited ? "cancel favorite" : "set favorite";
				}
			}
		};
	})
}
