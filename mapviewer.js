(function() {
	function sformat(str) {
		var args = arguments;
		return str.replace(/{(\d+)}/g, function(match, number) { 
			return typeof args[number] != 'undefined'
				? args[number]
				: match;
			});
	};

	var tribe_colors = [ "#fff" ]
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

	function on_zoom(force_transition) {
		var trans = zoom.translate();
		var scale = zoom.scale();
		var target = content;
		if (force_transition || scale != cur_scale)
			target = content.transition();

		target.attr("transform", "translate(" + trans + ")" + " scale(" + scale + ")");

		cur_scale = scale;
		cur_trans = trans;
	}

	function update_cursor() {
		var pos = d3.mouse(this);
		var x = pos[0] / 4;
		var y = pos[1];
		var text = Math.floor(x) + " " + Math.floor(y)	;
		cursor_text.text(text);
	}

	function get_city(group_id) {
		return _(map_data.Cities).find(function(d) { return d.groupId == group_id });
	}

	function get_player(player_id) {
		return _(map_data.Players).find(function(d) { return d.playerId == player_id });
	}

	function get_tribe(tribe_id) {
		return _(map_data.Tribes).find(function(d) { return d.tribeId == tribe_id });
	}

	function show_city_info(city) {
		var text = sformat("City: {1} / Level {2} / Player: {3}{4}", city.name, city.level, get_player(city.playerId).name, city.tribeId != 0 && " (" + get_tribe(city.tribeId).name + ")" || "");
		info_text.text(text);
	}

	function show_troop_info(troop) {
		var city = get_city(troop.groupId)
		var text = sformat("Troop: {1} ({2}) / Player: {3}{4}", city.name, troop.troopId, get_player(city.playerId).name, city.tribeId != 0 && " (" + get_tribe(city.tribeId).name + ")" || "");
		info_text.text(text);
	}

	function show_stronghold_info(sh) {
		var text = sformat("Stronghold: {1} / Level {2} / {3}", sh.name, sh.level, sh.tribeId != 0 && get_tribe(sh.tribeId).name || "Unoccupied");
		info_text.text(text);
	}

	function clear_info() {
		info_text.text("");
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
			match_cities = map_data.Cities.filter(function(c) { return c.name.toLowerCase().indexOf(q) != -1; }).sort();
			match_players = map_data.Players.filter(function(c) { return c.name.toLowerCase().indexOf(q) != -1; });
			match_tribes = map_data.Tribes.filter(function(c) { return c.name.toLowerCase().indexOf(q) != -1; });
			match_strongholds = map_data.Strongholds.filter(function(c) { return c.name.toLowerCase().indexOf(q) != -1; });
		}

		function sort_function(x, y) { return x.name < y.name ? -1 : 1; }

		search_results_cities = search_results.selectAll(".city_search_result").data(match_cities);
		search_results_cities.exit().remove();
		search_results_cities.enter().append("div");
		search_results_cities
			.sort(sort_function)
			.attr("class", "city_search_result")
			.text(function(d) { return "City: " + d.name; })

		search_results_players = search_results.selectAll(".player_search_result").data(match_players);
		search_results_players.exit().remove();
		search_results_players.enter().append("div");
		search_results_players
			.sort(sort_function)
			.attr("class", "player_search_result")
			.text(function(d) { return "Player: " + d.name; });

		search_results_tribes = search_results.selectAll(".tribe_search_result").data(match_tribes);
		search_results_tribes.exit().remove();
		search_results_tribes.enter().append("div");
		search_results_tribes
			.sort(sort_function)
			.attr("class", "tribe_search_result")
			.text(function(d) { return "Tribe: " + d.name; });

		search_results_strongholds = search_results.selectAll(".stronghold_search_result").data(match_strongholds);
		search_results_strongholds.exit().remove();
		search_results_strongholds.enter().append("div");
		search_results_strongholds
			.sort(sort_function)
			.attr("class", "stronghold_search_result")
			.text(function(d) { return "Stronghold: " + d.name; });

			
		search_results
			.on("click", function() { 
				var obj = d3.select(d3.event.target).data()[0];
				if (obj.x || obj.y)
					center_map_tile(obj.x, obj.y, 1);
			})
	}

	function center_map_tile(x, y, scale) {
		scale = scale || zoom.scale();

		var svg_width = parseInt(svg.style("width"));
		var svg_height = parseInt(svg.style("height"));

		zoom.scale(scale);
		zoom.translate([(-x * 4) * scale + svg_width / 2, (-y) * scale + svg_height / 2])

		on_zoom(true);
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
			.attr("class", "influence")
			.attr("width", map_width)
			.attr("height", map_height)
			.attr("xlink:href", "influence_bitmap_small.png");

		// cities
		var cities = content.selectAll(".city")
			.data(data.Cities);

		var c = cities.enter().append("g")
			.attr("class", "city")

		c.append("polygon")
			.attr("points", "-7,0 0,-4 7,0 0,4") // this is faster than a symbol/use pattern
			.attr("stroke", "black")
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1) + ")" /* + " scale(" + Math.min(2, Math.max(1, (d.value/70))) + ")"*/; })
			.attr("fill", function(d, i) { return get_tribe_color(d.tribeId); })

		c.append("text")
			.text(function(d) { return d.name; })
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1+20) + ")"; })
			.attr("text-anchor", "middle")

		// strongholds
		var strongholds = content.selectAll(".stronghold")
			.data(data.Strongholds);

		c = strongholds.enter().append("g")
			.attr("class", "stronghold")

		c.append("circle")
			.attr("r", function(d) { return d.level * 2; } )
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1) + ")"  })
			.attr("stroke", "black")
			.attr("fill", function(d, i) { return get_tribe_color(d.tribeId); })
		
		c.append("text")
			.text(function(d) { return d.name; })
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1+20+d.level*2) + ")"; })
			.attr("text-anchor", "middle")

		// forests
		var forests = content.selectAll(".forest")
			.data(data.Forests);

		c = forests.enter().append("g")
			.attr("class", "forest")

		c.append("circle")
			.attr("r", 4 )
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1) + ")"  })
			.attr("stroke", "black")
			.attr("fill", "green")

		c.append("text")
			.text(function(d) { return d.level; })
			.attr("class", "small_level_text")
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1+15) + ")"; })
			.attr("text-anchor", "right")

		// barbarians
		var barbarians = content.selectAll(".barbarian")
			.data(data.Barbarians);

		c = barbarians.enter().append("g")
			.attr("class", "barbarian")

		c.append("circle")
			.attr("r", 4 )
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1) + ")"  })
			.attr("stroke", "black")
			.attr("fill", "blue")

		c.append("text")
			.text(function(d) { return d.level; })
			.attr("class", "small_level_text")
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1+15) + ")"; })
			.attr("text-anchor", "right")

		// troops
		var troops = content.selectAll(".troop")
			.data(data.Troops);

		c = troops.enter().append("g")
			.attr("class", "troop")

		c.append("circle")
			.attr("r", 4 )
			.attr("transform", function(d, i) { return "translate(" + (d.x*4) + "," + (d.y*1) + ")"  })
			.attr("stroke", "black")
			.attr("fill", function(d, i) { return get_tribe_color(d.tribeId); })

		// static text
		function static_text(container, x, y, w) {
			var g = container.append("g");
			for(yi = -w; yi <= w; ++yi) {
				for(xi = -w; xi <= w; ++xi) {
					if(xi == 0 && yi == 0) continue;
					g.append("text")
						.attr("class", "svg_static_text_outline")
						.attr("x", x + xi)
						.attr("y", y + yi);
				}
			}

			g.append("text")
				.attr("class", "svg_static_text")
				.attr("x", x)
				.attr("y", y)

			return g.selectAll("text");
		}

		cursor_text = static_text(zoom_container, 10, 20, 1);
		info_text = static_text(zoom_container, 10, 40, 1);

		// events
		function common_events(c) {
			c.on("click", function(d) { center_map_tile(d.x, d.y); })
				.on("dblclick", function(d) { center_map_tile(d.x, d.y, 1); })
				.on("mouseout", function(d) { clear_info() })		
		}

		cities.on("mouseover", function(d) { show_city_info(d); })
		strongholds.on("mouseover", function(d) { show_stronghold_info(d); })
		troops.on("mouseover", function(d) { show_troop_info(d); })

		common_events(cities);
		common_events(strongholds);
		common_events(troops);
		common_events(forests);
		common_events(barbarians);

		// search
		search_input = d3.select("#search");
		search_input.on("input", do_search);

		search_results = d3.select("#search_results");

		// filters
		function update_visibility(selector, checkbox) {
			content.selectAll(selector).attr("visibility", checkbox.checked ? "visible" : "hidden")
		}

		d3.select("#filter_forests")
			.on("change", function() { update_visibility(".forest", d3.event.target); })
		d3.select("#filter_strongholds")
			.on("change", function() { update_visibility(".stronghold", d3.event.target); })
		d3.select("#filter_troops")
			.on("change", function() { update_visibility(".troop", d3.event.target); })
		d3.select("#filter_barbarians")
			.on("change", function() { update_visibility(".barbarian", d3.event.target); })
		d3.select("#filter_influence")
			.on("change", function() { update_visibility(".influence", d3.event.target); })

		update_visibility(".forest", d3.select("#filter_forests")[0][0]);
		update_visibility(".stronghold", d3.select("#filter_strongholds")[0][0]);
		update_visibility(".troop", d3.select("#filter_troops")[0][0]);
		update_visibility(".barbarian", d3.select("#filter_barbarians")[0][0]);
		update_visibility(".influence", d3.select("#filter_influence")[0][0]);

		// other stuff
		d3.select("#snapshot_timestamp").text("Using data from " + new Date(map_data.SnapshotBegin));
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