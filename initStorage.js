function initStorage(tracker, options){
	tracker
    .run(function(storage){

		// initialize storage
		options.forEach(function(option){
			if(!storage.exists(option[0])){
				storage.set(option[0], option[1]);
			}
		});
		
    });
}