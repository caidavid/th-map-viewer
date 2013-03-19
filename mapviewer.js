(function() {
	function sformat(str) {
		var args = arguments;
		return str.replace(/{(\d+)}/g, function(match, number) { 
			return typeof args[number] != 'undefined'
				? args[number]
				: match;
			});
	};

	var tribe_colors = []
	function get_tribe_color(tribe_id) {
		if (!tribe_colors[tribe_id]) {
			tribe_colors[tribe_id] = "#" + Math.floor(Math.random()*16).toString(16) + Math.floor(Math.random()*16).toString(16) + Math.floor(Math.random()*16).toString(16) ; 
		}
		return tribe_colors[tribe_id];
	}
		
	var map_width = 13600;
	var map_height = 6200;
	var cur_trans;
	var cur_scale;
	var svg;
	var content;
	var map_data;

	function on_zoom() {
		//var trans = d3.event.translate;
		//var scale = d3.event.scale;
		var trans = zoom.translate();
		var scale = zoom.scale();
		var target = content;
		if (scale != cur_scale)
			target = content.transition().ease("quad");

		target.attr("transform", "translate(" + trans + ")" + " scale(" + scale + ")");

		cur_scale = scale;
		cur_trans = trans;
	}

	function update_cursor() {
		var pos = d3.mouse(this);
		var x = pos[0] / 4;
		var y = pos[1];
		var text = x.toFixed() + " " + y.toFixed();
		cursor_text.text(text);
	}

	function get_player_name(player_id) {
		return map_data.Players.indexOf(function(d) { return d.playerId == player_id})
	}

	function format_city(city) {
		return sformat("{1} / {2} / {3} / {4}", city.name, city.level, get_player_name(city.playerId), "");
	}

	var search_input
	var search_results
	function do_search() {
		var q = search_input.property("value");
		var match_cities = [];
		var match_players = [];
		var match_tribes = [];
		var match_strongholds = [];
		
		if(q && q.length > 0) {
			q = q.toLowerCase();
			match_cities = map_data.Cities.filter(function(c) { return c.name.toLowerCase().indexOf(q) != -1; });
			match_players = map_data.Players.filter(function(c) { return c.name.toLowerCase().indexOf(q) != -1; });
			match_tribes = map_data.Tribes.filter(function(c) { return c.name.toLowerCase().indexOf(q) != -1; });
			match_strongholds = map_data.Strongholds.filter(function(c) { return c.name.toLowerCase().indexOf(q) != -1; });
		}

		search_results_cities = search_results.selectAll(".city_search_result").data(match_cities);
		search_results_cities.exit().remove();
		search_results_cities.enter().append("div");
		search_results_cities
			.attr("class", "city_search_result")
			.text(function(d) { return "City: " + d.name; });

		search_results_players = search_results.selectAll(".player_search_result").data(match_players);
		search_results_players.exit().remove();
		search_results_players.enter().append("div");
		search_results_players
			.attr("class", "player_search_result")
			.text(function(d) { return "Player: " + d.name; });

		search_results_tribes = search_results.selectAll(".tribe_search_result").data(match_tribes);
		search_results_tribes.exit().remove();
		search_results_tribes.enter().append("div");
		search_results_tribes
			.attr("class", "tribe_search_result")
			.text(function(d) { return "Tribe: " + d.name; });

		search_results_strongholds = search_results.selectAll(".stronghold_search_result").data(match_strongholds);
		search_results_strongholds.exit().remove();
		search_results_strongholds.enter().append("div");
		search_results_strongholds
			.attr("class", "stronghold_search_result")
			.text(function(d) { return "Stronghold: " + d.name; });

		search_results.on("click", function() { 
			var obj = d3.select(d3.event.target).data()[0];
			console.log(obj);
			var svg_width = parseInt(svg.style("width"));
			var svg_height = parseInt(svg.style("height"));
			zoom.scale(get_min_zoom_scale());
			on_zoom();
			zoom.translate([-obj.x * 4 + svg_width / 2, -obj.y + svg_height / 2])
			zoom.scale(1);
			on_zoom();
		})
	}

	function get_min_zoom_scale() {
		var svg_width = parseInt(svg.style("width"));
		var svg_height = parseInt(svg.style("height"));
		return Math.min(svg_width/map_width, svg_height/map_height)
	}

	function init_map(data) {
		map_data = data;
		svg = d3.select("svg");

		cur_scale = get_min_zoom_scale();
 		cur_trans = [0, 0];

		zoom = d3.behavior.zoom()
			.translate(cur_trans)
    		.scale(cur_scale)
    		.scaleExtent([get_min_zoom_scale(), 1])
    		.on("zoom", on_zoom);

		d3.select(window).on("resize", function() {
			var min_scale = get_min_zoom_scale() 
    		if(zoom.scale() < min_scale || zoom.scale() == zoom.scaleExtent()[0]) {
    			zoom.scale(min_scale);
    			on_zoom();
    		}
    		zoom.scaleExtent([min_scale, 1])
		})

		zoom_container = svg.append("g")
			.call(zoom)

		// map content
		content = zoom_container.append("g")
			.attr("transform", "scale("+cur_scale+")")
			.on("mousemove", update_cursor);

		// background
		content.append("rect")
			.attr("width", map_width)
			.attr("height", map_height)
			.attr("fill", "white");

		// influence image
		content.append("image")
			.attr("width", map_width)
			.attr("height", map_height)
			.attr("xlink:href", "influence_bitmap_small.png");

		// cities
		var cities = content.selectAll(".city")
			.data(data.Cities);

		var c = cities.enter().append("g")
			.attr("class", "city")

		c.append("polygon")
			.attr("points", "-7,0 0,-4 7,0 0,4")
			.attr("stroke", "black")
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1) + ")" /* + " scale(" + Math.min(2, Math.max(1, (d.value/70))) + ")"*/; })
			.attr("fill", function(d, i) { return get_tribe_color(d.tribeId); })
			.on("mouseover", function(d) { info_text.text(format_city(d)); })
			.on("mouseout", function(d) { info_text.text("") })

		c.append("text")
			.text(function(d) { return d.name; })
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1+20) + ")" /* + " scale(" + Math.min(2, Math.max(1, (d.value/70))) + ")"*/; })
			.attr("text-anchor", "middle")
/*
		cities.enter().append("use")
			.attr("xlink:href", "#sym-city")
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1) + ")" + " scale(" + (d.value/70) + ")"; })
			.attr("fill", function(d, i) { return get_tribe_color(d.tribeId); })
*/
/*
		cities.enter().append("circle")
			// .attr("cx", function(d, i) { return d.x * 4; })
			// .attr("cy", function(d, i) { return d.y * 1; })
			.attr("r", 10)
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1) + ")" + " scale(" + (d.value/70) + ")"; })
			.attr("stroke", "black")
			.attr("fill", function(d, i) { return get_tribe_color(d.tribeId); })
*/
		// strongholds
		var strongholds = content.selectAll(".stronghold")
			.data(data.Strongholds);

		strongholds.enter().append("circle")
			.attr("class", "stronghold")
			.attr("r", function(d) { return d.level * 2; } )
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1) + ")"  })
			.attr("stroke", "black")
			.attr("fill", function(d, i) { return get_tribe_color(d.tribeId); })
		
		// forests
		var forests = content.selectAll(".forest")
			.data(data.Forests);

		forests.enter().append("circle")
			.attr("class", "forest")
			.attr("r", 4 )
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1) + ")"  })
			.attr("stroke", "black")
			.attr("fill", "green")

		// static stuff
		cursor_text = zoom_container.append("text")
			.attr("x", 10)
			.attr("y", 20)
			.attr("fill", "black")

		info_text = zoom_container.append("text")
			.attr("x", 10)
			.attr("y", 40)
			.attr("fill", "black")

		// search
		search_input = d3.select("#search");
		search_input.on("input", do_search);

		search_results = d3.select("#search_results");
	}

	d3.json("map.json", function(error, data) {
		if(error) {
			alert("Failed to load the map data file, reload the page to try again");
		}
		else {
			init_map(data);
		}
	});
})();