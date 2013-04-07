(function() {
	var base_url = "";

	function sformat(str) {
		var args = arguments;
		return str.replace(/{(\d+)}/g, function(match, number) {
			return typeof args[number] != 'undefined'
				? args[number]
				: match;
		});
	}

	function hex_to_rgb(hex) {
		var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : null;
	}

	function get_random_color(list, id) {
		var c = list[id];
		if (c) {
			return c;
		}
		else {
			return list[id] = ("#" 
				+ Math.floor(Math.random()*(0xff-0x10)+0x10).toString(16) 
				+ Math.floor(Math.random()*(0xff-0x10)+0x10).toString(16) 
				+ Math.floor(Math.random()*(0xff-0x10)+0x10).toString(16));
		}
	}

	var tribe_colors = { 0: "#ffffff" };
	function get_tribe_color(tribe_id) {
		return get_random_color(tribe_colors, tribe_id);
	}

	var tribe_colors_rgb = {};
	function get_tribe_color_rgb(tribe_id) {
		var c = tribe_colors_rgb[tribe_id]
		if (!c) {
			return tribe_colors_rgb[tribe_id] = hex_to_rgb(get_tribe_color(tribe_id));
		} else {
			return c;
		}
	}

	var color_tribes = {};
	function get_tribe_by_color(r, g, b) {
		var col = "#" + ("000000" + (r << 16 | g << 8 | b).toString(16)).slice(-6);
		return color_tribes[col];
	}

	var player_colors = {};
	function get_player_color(player_id) {
		return get_random_color(player_colors, player_id);
	}

	var tiles_width = 3400;
	var tiles_height = 6200;
	var map_width = tiles_width * 4;
	var map_height = tiles_height;

	var map_data;
	var influence_image;
	var cur_trans = [ 0, 0 ];
	var cur_scale;

	var canvas;
	var canvas_ctx;
	var content;
	var info_text, info_text_2, cursor_text, changes_text;

	var canvas_width;
	var canvas_height;
	var xmin, xmax;
	var ymin, ymax;

	function on_zoom() {
		var trans = zoom.translate().slice();
		var scale = zoom.scale();

		if (scale != cur_scale) {
			transition_zoom(trans, scale, 250);
		}
		else {
			d3.transition().duration(0); // abort transition
			set_zoom(trans, scale);
			draw();
		}
	}

	var transition_end_timeout;
	function transition_zoom(trans, scale, duration) {
		d3.timer.flush();

		var t1 = cur_trans.slice();
		var s1 = cur_scale;

		var t2 = trans.slice();
		var s2 = scale;

		d3.transition()
			.delay(0)
			.duration(duration)
			.ease("quad-out")
			.tween("zoom", function() {
				itrans = d3.interpolate(t1, t2);
				iscale = d3.interpolate(s1, s2);
				return function(t) {
					var trans = itrans(t);
					var scale = iscale(t);
					set_zoom(trans, scale);
					draw(t == 1 && "transition end", t != 1 && "transition");
				}
			})
			.each("end", function() {
				/*
				set_zoom(cur_trans, cur_scale);
				//draw(true);
				clearTimeout(transition_end_timeout)
				transition_end_timeout = setTimeout(function() { draw(true); }, 1000);
				*/
			})
		d3.timer.flush();
	}

	function transform_point(x, y) {
		var tx = (x - cur_trans[0]) / cur_scale;
		var ty = (y - cur_trans[1]) / cur_scale;
		return [tx, ty];
	}

	function set_zoom(trans, scale, skip) {
		cur_trans = trans;
		cur_scale = scale;

		if (!skip) {
			zoom.translate(trans);
			zoom.scale(scale);
		}

		// set canvas transformation
		canvas_ctx.restore();
		canvas_ctx.save();

		// snap to grid at 100% zoom
		if (scale == 1.0) {
			canvas_ctx.translate(Math.floor(trans[0] + 0.5) + 0.5, Math.floor(trans[1] + 0.5) + 0.5);
		}
		else {
			canvas_ctx.translate(trans[0] + 0.5, trans[1] + 0.5);
		}

		canvas_ctx.scale(scale, scale);

		// update viewport extents
		var margin_x = 100, margin_y = 50;

		var min = transform_point(-margin_x, -margin_y);
		var max = transform_point(canvas_width + margin_x, canvas_height + margin_y);

		// neccesary with mirroring transforms
	 	xmin = Math.min(min[0], max[0]) / 4; ymin = Math.min(min[1], max[1]);
	 	xmax = Math.max(min[0], max[0]) / 4; ymax = Math.max(min[1], max[1]);
	}

	var mouse_raw;
	var mouse_x = 0, mouse_y = 0;
	var last_frame_time = 0;

	function update_cursor_text() {
		var x = Math.max(0, Math.min(tiles_width, Math.floor(mouse_x / 4)));
		var y = Math.max(0, Math.min(tiles_height, Math.floor(mouse_y)));
		cursor_text.text(sformat("{1} {2} {3}% {4} ms", x, y, Math.round(cur_scale * 100), last_frame_time.toFixed(0)));
	}

	function get_game_distance(x1, y1, x2, y2) {
		return Math.abs(x1 - x2) + Math.abs(y1 - y2) / 2;
	}

	function update_dist_text(obj) {
		if (!obj || get_selection().length == 0) {
			info_text_2.text("");
			return;
		}

		var target = _(get_selection()).min(function(sel) { return get_game_distance(obj.x, obj.y, sel.x, sel.y); });
		var dist = Math.floor(get_game_distance(obj.x, obj.y, target.x, target.y));
		info_text_2.text(sformat("{1} tiles from {2}", dist, target.name));
	}

	function update_snapshot_timestamp() {
		var date = new Date(map_data.SnapshotEnd);
		var age = (new Date().getTime() - date.getTime());
		var update_str;
		if (age < 60*1000) {
			var t = Math.floor(age / 1000);
			update_str = t + " second" + (t == 1 ? "" : "s") + " ago";
			setTimeout(update_snapshot_timestamp, 1000 - age % 1000);
		}
		else if (age < 3600*1000) {
			var t = Math.floor(age / 60000);
			update_str = t + " minute" + (t == 1 ? "" : "s") + " ago";
			setTimeout(update_snapshot_timestamp, 60000 - age % 60000);
		}
		else if (age < 12*3600*1000) {
			var t = Math.floor(age / 3600000);
			var m = Math.floor(age % 3600000 / 60000);
			update_str = t + " hour" + (t == 1 ? "" : "s");
			if (m > 0) {
				update_str += " and " + m + " minute" + (m == 1 ? "" : "s");
			} 
			update_str +=  " ago";
			setTimeout(update_snapshot_timestamp, 60000 - age % 60000);
		}
		else {
			update_str = date.toLocaleString();
		}

		//if (age > (70*60*1000)) {
		//	load_resources(true);
		//}

		d3.select("#snapshot_timestamp").text("Last updated: " + update_str);
	}	

	var frame_objects = {
		forests: [],
		troops: [],
		barbarians: [],
		cities: [],
		strongholds: []
	}

	function get_object_by_location(x, y) {
		function get_dist_sq(ox, oy) {
			var dx = ox - x, dy = oy - y;
			return dx * dx + dy * dy;
		}

		min_dist_sq = 10 * 10;

		for (var i = 0; i < frame_objects.strongholds.length; ++i) {
			var obj = frame_objects.strongholds[i];
			var dist_sq = get_dist_sq(obj.x * 4, obj.y);
			if (dist_sq < min_dist_sq) {
				return [ "stronghold", obj ];
			}
		}

		for (var i = 0; i < frame_objects.troops.length; ++i) {
			var obj = frame_objects.troops[i];
			var dist_sq = get_dist_sq(obj.x * 4, obj.y);
			if (dist_sq < min_dist_sq) {
				return [ "troop", obj ];
			}
		}

		for (var i = 0; i < frame_objects.cities.length; ++i) {
			var obj = frame_objects.cities[i];
			var dist_sq = get_dist_sq(obj.x * 4, obj.y);
			if (dist_sq < min_dist_sq) {
				return [ "city", obj ];
			}
		}
	}

	var mouseover_timer;

	function on_canvas_mousemove() {
		// update mouse coords
		var pos = d3.mouse(this);
		var tpos = transform_point(pos[0], pos[1]);
		mouse_raw = pos;
		mouse_x = tpos[0];
		mouse_y = tpos[1];
		update_cursor_text();

		// show mouseover object info
		var obj = get_object_by_location(mouse_x, mouse_y);
		canvas.style("cursor", obj ? "pointer" : "auto")
		update_dist_text(obj && obj[1]);
		if (obj) {
			clearTimeout(mouseover_timer);
			mouseover_timer = null;
			var text = "";
			switch (obj[0]) {
				case "troop":
					text = show_troop_info(obj[1]);
					break;
				case "barbarian":
					text = show_barbarian_info(obj[1]);
					break;
				case "city":
					text = show_city_info(obj[1]);
					break;
				case "stronghold":
					text = show_stronghold_info(obj[1]);
					break;
			}
			info_text.text(text);
		}
		else if (filters.influence) {
			if (!mouseover_timer) {
				mouseover_timer = setTimeout(update_mouseover_influence, 100);
			}
		}
		else {
			info_text.text("");
		}
	}

	function update_mouseover_influence() {
		mouseover_timer = null;
		var img_data = canvas_ctx.getImageData(mouse_raw[0], mouse_raw[1], 1, 1).data;
		var tribeid = get_tribe_by_color(img_data[0], img_data[1], img_data[2]);
		if (tribeid) {
			info_text.text(get_tribe(tribeid).name);
		}
		else {
			info_text.text("");
		}
	}

	var selected_objects = [];
	var selection_radius = 0, selection_center = [];

	function set_selection(obj) {
		if (obj) {
			selected_objects = [].concat(obj);
		}
		else {
			selected_objects = [];	
		}
		update_selection();
	}

	function add_selection(obj) {
		selected_objects = selected_objects.concat(obj);
		update_selection();
	}

	function get_selection() {
		return selected_objects;
	}

	function is_selected(obj) {
		return selected_objects.indexOf(obj) != -1;
	}

	function update_selection() {
		selection_center = calc_selection_center();
		selection_radius = calc_selection_radius();
	}

	function get_selection_center() {
		return selection_center;
	}

	function get_selection_radius() {
		return selection_radius;
	}

	function calc_selection_center() {
		var min_x = tiles_width, max_x  = 0;
		var min_y = tiles_height, max_y = 0;
		_(selected_objects).each(function(c) {
			min_x = Math.min(min_x, c.x);
			min_y = Math.min(min_y, c.y);
			max_x = Math.max(max_x, c.x);
			max_y = Math.max(max_y, c.y);
		})
		return [(max_x + min_x) / 2, (max_y + min_y) / 2];
	}

	function calc_selection_radius() {
		var center = get_selection_center();
		var dists_sq = _(selected_objects).map(function(c) {
			var xd = c.x * 4 - center[0] * 4;
			var yd = c.y - center[1];
			return xd*xd + yd*yd;
		});
		return Math.sqrt(_(dists_sq).max());
	}

	function on_canvas_click() {
		canvas.node().focus();

		var obj = get_object_by_location(mouse_x, mouse_y);

		if (obj) {
			var sel_obj = obj[1];
			if (sel_obj.playerId && d3.event.shiftKey) {
				sel_obj = get_player(sel_obj.playerId);
			}
			select_object(sel_obj);
			center_map_tile(obj[1].x, obj[1].y);
			if (obj[1].name) {
				update_url(obj[1].name);
			}
		}
		else {
			draw();
		}
	}

	function get_city(group_id) {
		return _(map_data.Cities).find(function(d) { return d.groupId == group_id });
	}

	function get_player(player_id) {
		return _(map_data.Players).find(function(d) { return d.playerId == player_id });
	}

	function get_tribe(tribe_id, data) {
		return _(data || map_data.Tribes).find(function(d) { return d.tribeId == tribe_id });
	}

	function show_city_info(city) {
		return sformat("City: {1} / Level {2} ({3} IP) / Player: {4}{5}", city.name, city.level, city.value, get_player(city.playerId).name, city.tribeId != 0 && " (" + get_tribe(city.tribeId).name + ")" || "");
	}

	function show_troop_info(troop) {
		var city = get_city(troop.groupId)
		return sformat("Troop: {1} ({2}) / Player: {3}{4}", city.name, troop.troopId, get_player(city.playerId).name, city.tribeId != 0 && " (" + get_tribe(city.tribeId).name + ")" || "");
	}

	function show_stronghold_info(sh) {
		return sformat("Stronghold: {1} / Level {2} / {3}", sh.name, sh.level, sh.tribeId != 0 && get_tribe(sh.tribeId).name || "Unoccupied");
	}

	var search_input;
	var search_results;

	function object_name_sort_comparer(x, y) {
		return x.name < y.name ? -1 : 1;
	}

	function filter_object(obj) {
		if (obj.x) {
			return obj;
		}
		else {
			return map_data.Cities.filter(
				function(c) {
					return (obj.tribeId && (obj.tribeId == c.tribeId)) || (obj.playerId && (obj.playerId == c.playerId));
				});
		}
	}

	function select_object(obj, append) {
		var sel_objs = filter_object(obj);
		
		if (append) {
			add_selection(sel_objs)
		}
		else {
			update_url(obj.name);
			set_selection(sel_objs);
		}
	}

	function set_selected_result(node) {
		d3.select(".selected_search_result").classed("selected_search_result", false);
		d3.select(node).classed("selected_search_result", true);
	}

	function search_result_click(obj) {
		set_selected_result(this);
		select_object(obj, d3.event.ctrlKey);
		center_map_selection();
	}

	function do_search(q) {
		var match_cities = [];
		var match_players = [];
		var match_tribes = [];
		var match_strongholds = [];

		if (q && q.length > 0) {
			q = q.toLowerCase();
			var filter_fn = function(c) { return c.name.toLowerCase().indexOf(q) != -1; };
			var exact_filter_fn = function(c) { return c.name.toLowerCase() == q; };

			match_cities = map_data.Cities.filter(filter_fn);
			match_players = map_data.Players.filter(filter_fn);
			match_tribes = map_data.Tribes.filter(filter_fn);
			match_strongholds = map_data.Strongholds.filter(filter_fn);
		}

		// cities
		var search_results_cities = search_results.selectAll(".city_search_result").data(match_cities);
		search_results_cities.exit().remove();
		search_results_cities.enter().append("div");
		search_results_cities
			.sort(object_name_sort_comparer)
			.attr("class", "search_result city_search_result")
			.text(function(d) { return "City: " + d.name; })
			.on("click", search_result_click);

		// players
		var search_results_players = search_results.selectAll(".player_search_result").data(match_players);
		search_results_players.exit().remove();
		search_results_players.enter().append("div");
		search_results_players
			.sort(object_name_sort_comparer)
			.attr("class", "search_result player_search_result")
			.text(function(d) { return "Player: " + d.name; })
			.on("click", search_result_click);

		// tribes
		var search_results_tribes = search_results.selectAll(".tribe_search_result").data(match_tribes);
		search_results_tribes.exit().remove();
		search_results_tribes.enter().append("div");
		search_results_tribes
			.sort(object_name_sort_comparer)
			.attr("class", "search_result tribe_search_result")
			.text(function(d) { return "Tribe: " + d.name; })
			.on("click", search_result_click);

		// strongholds
		var search_results_strongholds = search_results.selectAll(".stronghold_search_result").data(match_strongholds);
		search_results_strongholds.exit().remove();
		search_results_strongholds.enter().append("div");
		search_results_strongholds
			.sort(object_name_sort_comparer)
			.attr("class", "search_result stronghold_search_result")
			.text(function(d) { return "Stronghold: " + d.name; })
			.on("click", search_result_click);

		// if there is only one result or an exact result, jump to it
		var num_results = match_cities.length + match_players.length + match_tribes.length + match_strongholds.length;
		var exact = _(match_cities).find(exact_filter_fn) || _(match_players).find(exact_filter_fn) || _(match_tribes).find(exact_filter_fn) || _(match_strongholds).find(exact_filter_fn);
		if (num_results == 1 || exact) {
			var obj = exact || match_cities[0] || match_players[0] || match_tribes[0] || match_strongholds[0];
			set_selected_result(d3.selectAll(".search_result").filter(function(d) { return d == obj; }).node());
			select_object(obj);
			center_map_selection();
		}

		// check if the user entered coordinates
		var coords_regexp = /^\s*(\d+)[\s,]+(\d+)\s*$/;
		var match = coords_regexp.exec(q);
		if (match) {
			var x = match[1], y = match[2];
			if (x >= 0 && x <= tiles_width && y >= 0 && y <= tiles_height) {
				center_map_tile(x, y);
				update_url(q);
			}
		}
	}

	function center_map_tile(x, y, scale) {
		scale = scale || cur_scale;

		var trans = [(-x * 4) * scale + canvas_width / 2, (-y) * scale + canvas_height / 2];
		var scale = scale;

		transition_zoom(trans, scale, 1000);
	}

	function center_map_selection() {
		var pos = get_selection_center();
		var d = (get_selection_radius() + 110) * 2;
		var scale = Math.max(get_min_zoom_scale(), Math.min(1, canvas_width / d, canvas_height / d));

		center_map_tile(pos[0], pos[1], scale);
	}

	function get_min_zoom_scale() {
		return Math.min(canvas_width / map_width, canvas_height / map_height)
	}

	function resize_canvas() {
		var w = parseInt(canvas.style("width"));
		var h = parseInt(canvas.style("height"));
		canvas.attr("width", w);
		canvas.attr("height", h);
		canvas_width = w;
		canvas_height = h;
	}

	function init_tribe_colors(data) {
		for (var i = 0; i < data.length; ++i) {
			var tcol = data[i];
			tribe_colors[tcol.tribeId] = tcol.color;
			tribe_colors_rgb[tcol.tribeId] = hex_to_rgb(tcol.color);
			color_tribes[tcol.color] = tcol.tribeId;
		}
		draw("init_tribe_colors");
	}
	
	var city_locations;
	
	function init_city_locations(data) {
		city_locations = data;

		if (update_foundations()) {
			draw("init_city_locations");
		}
	}

	function update_foundations() {
		if (!city_locations || !map_data)
			return false;

		// create a sorted list of cities to be able to search them efficiently
		var cities_pos = _(map_data.Cities).map(function(city) { return city.x + city.y * tiles_width; }).sort(function(a, b) { return a - b; });

		var available_foundations = city_locations.filter(function(foundation) {
			foundation.draw = draw_foundation;
			return -1 == _(cities_pos).indexOf(foundation.x + foundation.y * tiles_width, true);
		});

		_(available_foundations).each(map_quadtree.add);

		return true;
	}


	var first_map_update = true;

	var map_quadtree;

	var prev_map_data;

	var map_data_apply_prev;

	function init_prev_map(data) {
		prev_map_data = data;

		if (!map_data_apply_prev) {
			return;
		}

		// find previous troop instances
		_(map_data_apply_prev.Troops).each(function(cur) {
			var prev = _(prev_map_data.Troops).find(function(pobj) { return pobj.groupId == cur.groupId && pobj.troopId == cur.troopId; });
			if (prev) {
				cur.prev = prev;
			}
		});

		// find stronghold ownership changes
		var changed_strongholds = [];
		_(map_data_apply_prev.Strongholds).each(function(cur) {
			var prev = _(prev_map_data.Strongholds).find(function(pobj) { return pobj.id == cur.id; });
			if (prev && prev.tribeId != cur.tribeId) {
				changed_strongholds.push([prev, cur]);
			}
		});

		// format and display changes
		var c = changes_text.selectAll("div").data(changed_strongholds);
		c.exit().remove();
		c.enter().append("div")
			.sort(function(a, b) { return a[1].tribeId - b[1].tribeId; })
			.html(function(shch) {
				var prev_tribe = shch[0].tribeId && get_tribe(shch[0].tribeId, prev_map_data.Tribes).name || "";
				var cur_tribe = shch[1].tribeId && get_tribe(shch[1].tribeId, map_data_apply_prev.Tribes).name || "(Unoccupied)";
				return sformat("<span style='color:gold; font-weight:bold;'>{1} ({2})</span> <span style='background-color:{3}'>{4}</span> =&gt; <span style='background-color:{5}'>{6}</span>",
					shch[0].name, shch[0].level,
					get_tribe_color(shch[0].tribeId), prev_tribe, 
					get_tribe_color(shch[1].tribeId), cur_tribe);
			});

		map_data_apply_prev = null;
		prev_map_data = null;

		draw("init_prev_map");
	}

	function init_map(data) {
		map_data = data;

		// init quadtree
		map_quadtree = d3.geom.quadtree([], tiles_width, tiles_height);
		_(map_data.Cities).each(function(obj) { obj.draw = draw_city; map_quadtree.add(obj); })
		_(map_data.Troops).each(function(obj) { obj.draw = draw_troop; map_quadtree.add(obj); })
		_(map_data.Forests).each(function(obj) { obj.draw = draw_forest; map_quadtree.add(obj); })
		_(map_data.Barbarians).each(function(obj) { obj.draw = draw_barbarian; map_quadtree.add(obj); })
		_(map_data.Strongholds).each(function(obj) { obj.draw = draw_stronghold; map_quadtree.add(obj); })
		
		// static info
		update_snapshot_timestamp();

		map_data_apply_prev = map_data;

		if (prev_map_data) {
			init_prev_map(prev_map_data);
		}

		update_foundations();

		// initial draw
		draw("init_map");

		// first time stuff
		if (first_map_update) {
			first_map_update = false;

			// search
			search_input = d3.select("#search");
			search_input.on("input", function() {
				clearTimeout(do_search_timeout)
				do_search_timeout = setTimeout(function() {
					do_search(search_input.property("value"))
				}, 50);
			});

			search_input.node().focus();
			search_input.node().select();

			search_results = d3.select("#search_results");

			// canvas events
			canvas.on("mousemove", on_canvas_mousemove);
			canvas.on("click", on_canvas_click);

			// hash url state
			d3.select(window).on("hashchange", update_from_url);
			if (!update_from_url()) {
				var q = search_input.property("value");
				if (q && q.length > 0) {
					do_search(q);
				}
			}
		}
	}

	var filters = {
		city: true,
		stronghold: true,
		influence: true,
	};
	var do_search_timeout;

	function init() {
		// filters
		function update_filter_visibility(selector, checkbox) {
			filters[selector] = checkbox.checked;
			if (window.localStorage && JSON) {
				window.localStorage["filters"] = JSON.stringify(filters);
			}
			draw("filter");
		}

		d3.select("#filter_cities").on("change", function() { update_filter_visibility("city", d3.event.target); });
		d3.select("#filter_forests").on("change", function() { update_filter_visibility("forest", d3.event.target); });
		d3.select("#filter_strongholds").on("change", function() { update_filter_visibility("stronghold", d3.event.target); });
		d3.select("#filter_troops").on("change", function() { update_filter_visibility("troop", d3.event.target); });
		d3.select("#filter_troop_trails").on("change", function() { update_filter_visibility("troop_trail", d3.event.target); });
		d3.select("#filter_barbarians").on("change", function() { update_filter_visibility("barbarian", d3.event.target); });
		d3.select("#filter_influence").on("change", function() { update_filter_visibility("influence", d3.event.target); });
		d3.select("#filter_foundations").on("change", function() { update_filter_visibility("foundation", d3.event.target); });

		// load filters from localStorage
		if (window.localStorage && window.localStorage["filters"]) {
			try {
				filters = JSON.parse(window.localStorage["filters"]);
			}
			catch(e) {
			}
		}

		// update filter checkboxes
		d3.select("#filter_cities").attr("checked", filters.city && "checked" || null);
		d3.select("#filter_forests").attr("checked", filters.forest && "checked" || null);
		d3.select("#filter_strongholds").attr("checked", filters.stronghold && "checked" || null);
		d3.select("#filter_troops").attr("checked", filters.troop && "checked" || null);
		d3.select("#filter_troop_trails").attr("checked", filters.troop_trail && "checked" || null);
		d3.select("#filter_barbarians").attr("checked", filters.barbarian && "checked" || null);
		d3.select("#filter_influence").attr("checked", filters.influence && "checked" || null);
		d3.select("#filter_foundations").attr("checked", filters.foundation && "checked" || null);

		// info texts
		cursor_text = d3.select("#cursor_text");
		info_text = d3.select("#info_text");
		info_text_2 = d3.select("#info_text_2");
		changes_text = d3.select("#changes_text");

		// load resources
		load_resources();

		// init canvas
		content = d3.select("#content");
		canvas = d3.select("canvas");
		canvas_ctx = canvas.node().getContext("2d");
		canvas_ctx.save();
		resize_canvas();

		// font
		init_fonts(canvas.style("font-family"));

		// init zoom
		cur_scale = get_min_zoom_scale();
		cur_trans = [-map_width / 2 * cur_scale + canvas_width / 2, -map_height / 2 * cur_scale + canvas_height / 2];

		zoom = d3.behavior.zoom()
			.translate(cur_trans)
			.scale(cur_scale)
			.scaleExtent([get_min_zoom_scale(), 1])
			.on("zoom", on_zoom);

		canvas.call(zoom);

		canvas.on("keydown", function() {
			var scale = cur_scale;
			var x_center = (2 * cur_trans[0] - canvas_width) / (2 * scale);
			var y_center = (2 * cur_trans[1] - canvas_height) / (2 * scale);
			var step = 500;

			switch (d3.event.keyCode) {
				// DOM_VK_ADD	0x6B (107)	"+" on the numeric keypad.
				// DOM_VK_PLUS	0xAB (171)	Plus ("+") key. Requires Gecko 15.0
				// +
				case 107:
				case 171:
				case 187:
					var k = Math.log(scale) / Math.LN2;
					scale = Math.pow(2, Math.floor(k) + 1);
					break;

				// DOM_VK_SUBTRACT	0x6D (109)	"-" on the numeric keypad.
				// DOM_VK_HYPHEN_MINUS	0xAD (173)	Hyphen-US/docs/Minus ("-") key.
				// -
				case 109:
				case 173:
				case 189:
					var k = Math.log(scale) / Math.LN2;
					scale = Math.pow(2, Math.ceil(k) - 1);
					break;

				// DOM_VK_LEFT	0x25 (37)	Left arrow.
				case 37:
					x_center += step;
					break;

				// DOM_VK_UP	0x26 (38)	Up arrow.
				case 38:
					y_center += step;
					break;

				// DOM_VK_RIGHT	0x27 (39)	Right arrow.
				case 39:
					x_center -= step;
					break;

				// DOM_VK_DOWN	0x28 (40)	Down arrow.
				case 40:
					y_center -= step;
					break;

				default:
					return;
					break;
			}

			scale = Math.min(1, Math.max(get_min_zoom_scale(), scale));
			transition_zoom([
				(x_center * scale + canvas_width/2),
				(y_center * scale + canvas_height/2)
				], scale, 250);
		});

		on_zoom();

		d3.select(window).on("resize", function() {
			resize_canvas();

			var min_scale = get_min_zoom_scale()
			if (zoom.scale() < min_scale || zoom.scale() == zoom.scaleExtent()[0]) {
				zoom.scale(min_scale);
			}
			zoom.scaleExtent([min_scale, 1]);

			on_zoom();
		});
	}

	var last_load_resources;
	var load_resources_timeout;
	var min_load_resources_interval = 300*1000;
	function load_resources(force_reload) {
		if (last_load_resources) {
			var age = new Date().getTime() - last_load_resources.getTime();
			if (age < min_load_resources_interval) {
				if (load_resources_timeout) {
					var t = min_load_resources_interval - age % min_load_resources_interval;
					load_resources_timeout = setTimeout(function() { load_resources(force_reload); }, t);
					// increase interval after each attempt
					min_load_resources_interval *= 1.5;
				}
				return;
			}
		}

		last_load_resources = new Date();
		clearTimeout(load_resources_timeout);
		load_resources_timeout = null;

		cursor_text.text("Loading..");

		var query = "";
		if (force_reload) {
			query = "?" + (Math.random() * 1000000).toFixed();
		}

		d3.json(base_url + "tribe_colors.json" + query, function(error, data) {
			if (error) {
				cursor_text.text("Failed to load tribe colors");
			}
			else {
				init_tribe_colors(data);
			}
		});

		d3.json(base_url + "city_locations.json", function(error, data) {
			if (error && !map_data) {
				cursor_text.text("Failed to load the city locations data file");
			}
			else {
				init_city_locations(data);
			}
		});

		d3.json(base_url + "map.json" + query, function(error, data) {
			if (error && !map_data) {
				cursor_text.text("Failed");
				alert("Failed to load the map data file, reload the page to try again");
			}
			else {
				init_map(data);
			}
		});

		d3.json(base_url + "map_prev.json" + query, function(error, data) {
			if (error && !map_data) {
				cursor_text.text("Failed to load the previous map data file");
			}
			else {
				init_prev_map(data);
			}
		});

		var load_influence_image = new Image();
		load_influence_image.onload = function() {
			influence_image = load_influence_image;
			if (filters.influence) {
				draw("load_influence_image");
			}
		};
		load_influence_image.src = base_url + "influence_bitmap_small.png" + query;
	}

	var min_small_text_scale = 0.5;
	var min_normal_text_scale = 0.4;
	var min_large_text_scale = 0.3;

	var font_big;
	var font_normal;
	var font_small;

	function init_fonts(font_family) {
		font_big = "bold 10pt " + font_family;
		font_normal = "10pt " + font_family;
		font_small = "8pt " + font_family;
	}

	function draw_outlined_text(canvas_ctx, text, x, y, w, outline, fill) {
		canvas_ctx.fillStyle = outline;
		for (xi = -w; xi <= w; ++xi) {
			for (yi = -w; yi <= w; ++yi) {
				if (!(xi == 0 && yi == 0)) {
					canvas_ctx.fillText(text, x + xi, y + yi);
				}
			}
		}

		canvas_ctx.fillStyle = fill;
		canvas_ctx.fillText(text, x, y);
	}

	function draw_text(canvas_ctx) {
		// cities
		if (filters.city && cur_scale > min_normal_text_scale) {
			for (var i = 0; i < frame_objects.cities.length; ++i) {
				var city = frame_objects.cities[i];
				var x = city.x * 4;
				var y = city.y;
				canvas_ctx.font = font_normal;
				canvas_ctx.fillStyle = "black";
				canvas_ctx.textAlign = "center";
				canvas_ctx.fillText(city.name, x, y + 20);
			}
		}

		// strongholds
		if (filters.stronghold && cur_scale > min_large_text_scale) {
			for (var i = 0; i < frame_objects.strongholds.length; ++i) {
				var sh = frame_objects.strongholds[i];
				var x = sh.x * 4;
				var y = sh.y;
				canvas_ctx.font = font_big;
				canvas_ctx.fillStyle = "black";
				canvas_ctx.textAlign = "center";
				draw_outlined_text(canvas_ctx, sh.name, x, y + 30 + sh.level * 5, 1, "black", "gold");
			}
		}

		// forests
		if (filters.forest && cur_scale > min_small_text_scale) {
			for (var i = 0; i < frame_objects.forests.length; ++i) {
				var forest = frame_objects.forests[i];
				var x = forest.x * 4;
				var y = forest.y;
				canvas_ctx.font = font_small;
				canvas_ctx.fillStyle = "black";
				canvas_ctx.textAlign = "start";
				canvas_ctx.fillText(forest.level, x + 4, y + 12);
			}
		}

		// barbarians
		if (filters.barbarian && cur_scale > min_small_text_scale) {
			for (var i = 0; i < frame_objects.barbarians.length; ++i) {
				var barb = frame_objects.barbarians[i];
				var x = barb.x * 4;
				var y = barb.y;
				canvas_ctx.font = font_small;
				canvas_ctx.fillStyle = "black";
				canvas_ctx.textAlign = "start";
				canvas_ctx.fillText(barb.level, x + 4, y + 12);
			}
		}
	}

	function draw_circumference(canvas_ctx, x, y, rad, width, stroke, fill) {
		// colored circunference
		canvas_ctx.moveTo(x, y);
		canvas_ctx.beginPath();
		canvas_ctx.arc(x, y, rad, 0, 2 * Math.PI);
		canvas_ctx.closePath();

		canvas_ctx.strokeStyle = fill;
		canvas_ctx.lineWidth = 8;
		canvas_ctx.stroke();

		/* if (cur_scale > min_normal_text_scale) { */
		if (true) {
			// circunference borders
			canvas_ctx.strokeStyle = stroke;
			canvas_ctx.lineWidth = 2;

			canvas_ctx.moveTo(x, y);
			canvas_ctx.beginPath();
			canvas_ctx.arc(x, y, rad + width, 0, 2 * Math.PI);
			canvas_ctx.closePath();
			canvas_ctx.stroke();

			canvas_ctx.moveTo(x, y);
			canvas_ctx.beginPath();
			canvas_ctx.arc(x, y, rad - width, 0, 2 * Math.PI);
			canvas_ctx.closePath();
			canvas_ctx.stroke();
		}
	}

	var draw_text_timeout;
	var city_selection_color = "rgba(100, 149, 237, 1.0)";
	var selection_color = "rgba(100, 149, 237, 0.5)";

	function draw_forest(canvas_ctx, forest) {
		if (!filters.forest)
			return;

		frame_objects.forests.push(forest);
		var x = forest.x * 4;
		var y = forest.y;

		canvas_ctx.beginPath();
		canvas_ctx.arc(x, y, 4, 0, 2 * Math.PI);
		canvas_ctx.closePath();

		canvas_ctx.fillStyle = "green";
		canvas_ctx.fill();

		if (cur_scale > min_small_text_scale) {
			canvas_ctx.lineWidth = 1;
			canvas_ctx.strokeStyle = "black";
			canvas_ctx.stroke();
		}
	}

	function draw_barbarian(canvas_ctx, barb) {
		if (!filters.barbarian)
			return;

		frame_objects.barbarians.push(barb);
		var x = barb.x * 4;
		var y = barb.y;

		canvas_ctx.beginPath();
		canvas_ctx.arc(x, y, 4, 0, 2 * Math.PI);
		canvas_ctx.closePath();

		canvas_ctx.fillStyle = "blue";
		canvas_ctx.fill();

		if (cur_scale > min_small_text_scale) {
			canvas_ctx.lineWidth = 1;
			canvas_ctx.strokeStyle = "black";
			canvas_ctx.stroke();
		}
	}


	function draw_foundation(canvas_ctx, foundation) {
		if (!filters.foundation)
			return;

		var x = foundation.x * 4;
		var y = foundation.y;

		var w = 4;
		var h = 4;
		canvas_ctx.fillStyle = "firebrick";
		canvas_ctx.fillRect(x - w, y - h, w * 2, h * 2);

		if (cur_scale > min_small_text_scale) {
			canvas_ctx.lineWidth = 1;
			canvas_ctx.strokeStyle = "black";
			canvas_ctx.strokeRect(x - w, y - h, w * 2, h * 2);
		}
	}

	function draw_troop(canvas_ctx, troop) {
		if (!filters.troop)
			return;

		frame_objects.troops.push(troop);
	
		function draw_troop_snapshot(troop, fill) {
			var x = troop.x * 4;
			var y = troop.y;

			/*
			var angle = 0;
			if (troop.prev) {
				var xp = troop.prev.x * 4;
				var yp = troop.prev.y;

				angle = Math.atan2(xp - x, yp - y);
			}

			var w = 301/4;
			var h = 119/4;
			var xo = x - w/2;
			var yo = y - h/2;
			canvas_ctx.save();
			canvas_ctx.translate(x, y);
			if (troop.prev) {
				canvas_ctx.rotate(-angle - Math.PI * 2.5);
				canvas_ctx.scale(angle > Math.PI ? -1 : 1, angle < 0 ? 1 : -1);
			}
			canvas_ctx.translate(-(x), -(y));

			canvas_ctx.drawImage(troop_img, xo, yo, w, h);
			canvas_ctx.restore();
			*/

			canvas_ctx.beginPath();
			canvas_ctx.arc(x, y, 4, 0, 2 * Math.PI);
			canvas_ctx.closePath();

			canvas_ctx.fillStyle = fill;
			canvas_ctx.fill();

			if (cur_scale > min_small_text_scale) {
				canvas_ctx.lineWidth = 1;
				canvas_ctx.strokeStyle = "black";
				canvas_ctx.stroke();
			}
		}

		if (filters.troop_trail && troop.prev)  {
			canvas_ctx.beginPath();
			canvas_ctx.moveTo(troop.x * 4, troop.y);
			canvas_ctx.lineTo(troop.prev.x * 4, troop.prev.y);
			canvas_ctx.closePath();
			
			var grd1 = canvas_ctx.createLinearGradient(troop.x * 4, troop.y, troop.prev.x * 4, troop.prev.y);
			grd1.addColorStop(0, "rgba(255,255,255,1)");
			grd1.addColorStop(1, "rgba(255,255,255,0)");

			canvas_ctx.strokeStyle = grd1;
			canvas_ctx.lineWidth = 7;
			canvas_ctx.stroke();
			
			var grd2 = canvas_ctx.createLinearGradient(troop.x*4, troop.y, troop.prev.x*4, troop.prev.y);
			var rgb = get_tribe_color_rgb(troop.tribeId);
			grd2.addColorStop(0, get_tribe_color(troop.tribeId));
			grd2.addColorStop(1, "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", 0)");
			canvas_ctx.lineWidth = 6.5;
			canvas_ctx.strokeStyle = grd2;
			canvas_ctx.stroke();
		}

		draw_troop_snapshot(troop, get_tribe_color(troop.tribeId));
	}

	function draw_city(canvas_ctx, city) {
		if (!filters.city)
			return;

		frame_objects.cities.push(city);
		var x = city.x * 4;
		var y = city.y;

		if (cur_scale < min_normal_text_scale) {
			var cw = 7;
			var ch = 4;
			canvas_ctx.fillStyle = get_tribe_color(city.tribeId);
			canvas_ctx.beginPath();
			canvas_ctx.rect(x - cw, y - ch, cw * 2, ch * 2);
			canvas_ctx.closePath();
			canvas_ctx.fill();

			// selection border
			if (is_selected(city)) {
				canvas_ctx.strokeStyle = city_selection_color;
				canvas_ctx.lineWidth = 3;
				canvas_ctx.strokeRect(x - (cw + 1), y - (ch + 1), (cw + 1) * 2, (ch + 1) * 2);
			}
			else {
				canvas_ctx.lineWidth = 1;
				canvas_ctx.strokeStyle = "black";
				canvas_ctx.stroke();//strokeRect(x - (cw + 1), y - (ch + 1), (cw + 1) * 2, (ch + 1) * 2);
			}
		}
		else {
			var cw = 8;
			var ch = 4;

			// fill
			canvas_ctx.beginPath();
			canvas_ctx.moveTo(x - cw, y + 0);
			canvas_ctx.lineTo(x + 0,  y - ch);
			canvas_ctx.lineTo(x + cw, y + 0);
			canvas_ctx.lineTo(x + 0,  y + ch);
			canvas_ctx.closePath();
			canvas_ctx.fillStyle = get_tribe_color(city.tribeId);
			canvas_ctx.fill();

			// selection border
			if (is_selected(city)) {
				var cw_sb = cw + 6;
				var ch_sb = ch + 3;
				canvas_ctx.beginPath();
				canvas_ctx.moveTo(x - cw_sb, y + 0);
				canvas_ctx.lineTo(x + 0,  y - ch_sb);
				canvas_ctx.lineTo(x + cw_sb, y + 0);
				canvas_ctx.lineTo(x + 0,  y + ch_sb);
				canvas_ctx.closePath();
				canvas_ctx.strokeStyle = city_selection_color;
				canvas_ctx.lineWidth = 3;
				canvas_ctx.stroke();
			}

			// player color border
			var cw_pb = cw;
			var ch_pb = ch;
			canvas_ctx.lineWidth = 2;
			canvas_ctx.strokeStyle = get_player_color(city.playerId);
			canvas_ctx.beginPath();
			canvas_ctx.moveTo(x - cw_pb, y + 0);
			canvas_ctx.lineTo(x + 0,  y - ch_pb);
			canvas_ctx.lineTo(x + cw_pb, y + 0);
			canvas_ctx.lineTo(x + 0,  y + ch_pb);
			canvas_ctx.closePath();
			canvas_ctx.stroke();

			// black border
			var cw_bb = cw + 1;
			var ch_bb = ch + 0.5;
			canvas_ctx.lineWidth = 1.25;
			canvas_ctx.strokeStyle = "black";
			canvas_ctx.beginPath();
			canvas_ctx.moveTo(x - cw_bb, y + 0);
			canvas_ctx.lineTo(x + 0,  y - ch_bb);
			canvas_ctx.lineTo(x + cw_bb, y + 0);
			canvas_ctx.lineTo(x + 0,  y + ch_bb);
			canvas_ctx.closePath();
			canvas_ctx.stroke();
		}
	}
	
	function draw_stronghold(canvas_ctx, sh) {
		if (!filters.stronghold)
			return;

		frame_objects.strongholds.push(sh);
		var x = sh.x * 4;
		var y = sh.y;

		// inner dot
		canvas_ctx.beginPath();
		canvas_ctx.arc(x, y, 5, 0, 2 * Math.PI);
		canvas_ctx.closePath();

		canvas_ctx.fillStyle = get_tribe_color(sh.tribeId);
		canvas_ctx.fill();

		if (cur_scale > min_small_text_scale) {
			canvas_ctx.lineWidth = 1;
			canvas_ctx.strokeStyle = "black";
			canvas_ctx.stroke();
		}

		draw_circumference(canvas_ctx, x, y, 10 + sh.level * 5, 4, "black", get_tribe_color(sh.tribeId));
	}

	function draw_map(canvas_ctx, xmin, ymin, xmax, ymax) {
		var start_time = window.performance.now();

		function is_quad_outside_viewport(x1, y1, x2, y2) {
			return x1 >= xmax || y1 >= ymax || x2 < xmin || y2 < ymin;
		}

		function is_point_inside_viewport(x, y) {
			return x >= xmin && x < xmax && y >= ymin && y < ymax;
		}

		// clear frame objects
		frame_objects.forests.length = 0;
		frame_objects.troops.length = 0;
		frame_objects.barbarians.length = 0;
		frame_objects.cities.length = 0;
		frame_objects.strongholds.length = 0;

		// initial state
		canvas_ctx.lineCap = "square";
		canvas_ctx.lineJoin = "miter";

		// influence image
		if (filters.influence && influence_image) {
			canvas_ctx.drawImage(influence_image, 0, 0, map_width, map_height);
		}

		// objects
		map_quadtree.visit(function(node, x1, y1, x2, y2) {
			var obj = node.point;
			if (obj && is_point_inside_viewport(obj.x, obj.y)) {
				obj.draw(canvas_ctx, obj);
			}
			return is_quad_outside_viewport(x1, y1, x2, y2);
		});

		// text
		if (cur_scale > min_normal_text_scale) {
			draw_text(canvas_ctx);
		}
		else {
			clearTimeout(draw_text_timeout);
			draw_text_timeout = setTimeout(function() { draw_text(canvas_ctx); }, 10);
		}

		// selection
		if (get_selection().length > 0) {
			var pos = get_selection_center();
			var r = get_selection_radius();
			draw_circumference(canvas_ctx, pos[0] * 4, pos[1], r + 100, 4, "black", selection_color);
		}

		// update frame time
		var frame_time = window.performance.now() - start_time;
		last_frame_time = frame_time;
		update_cursor_text();
	}

	var draw_timeout;
	var update_buffer_timeout;
	function draw(force_update, force_from_buffer) {
		if (!map_data) {
			return;
		}

		// clear canvas
		canvas_ctx.save();
		canvas_ctx.setTransform(1, 0, 0, 1, 0, 0);
		canvas_ctx.clearRect(0, 0, canvas_width, canvas_height);
		canvas_ctx.restore();

		if (!buffer) {
			update_buffer(force_update + ": first update");
		}
		else if (force_update == "filter") {
			clearTimeout(update_buffer_timeout);
			update_buffer_timeout = null;
			update_buffer(force_update);
		}

		if (cur_scale > 0.9 || (!force_from_buffer && cur_scale > 0.6)) {
			clearTimeout(update_buffer_timeout);
			clearTimeout(draw_timeout);
			update_buffer_timeout = null;
			draw_map(canvas_ctx, xmin, ymin, xmax, ymax)
		}
		else {
			if (force_update || update_buffer_timeout) {
				clearTimeout(update_buffer_timeout);
				update_buffer_timeout = setTimeout(function() {
					update_buffer(force_update + ": force_update timeout");
					update_buffer_timeout = null;
				}, 1500)
			}

			canvas_ctx.drawImage(buffer, 0, 0, map_width, map_height);
			update_cursor_text();
			
			clearTimeout(draw_timeout);
			draw_timeout = setTimeout(function() { draw_map(canvas_ctx, xmin, ymin, xmax, ymax); }, 1000);
		}
	}

	function update_buffer(reason) {
		console.log(new Date(), reason)
		render_to_buffer();
	}

	// buffering
	var buffer;
	var buffer_ctx;
	function render_to_buffer() {
		if (!buffer) {
			buffer = document.createElement("canvas");
			buffer_ctx = buffer.getContext("2d");
		}
		var scale = Math.min(0.5, cur_scale);
		buffer.width = map_width * scale;
		buffer.height = map_height * scale;
	 	buffer_ctx.scale(scale, scale);
		draw_map(buffer_ctx, 0, 0, map_width, map_height);
	}

	// state serialization
	function serialize_state() {
		return search_input.property("value");
	}

	function deserialize_state(data) {
		search_input.property("value", data);
		search_input.node().focus();
		search_input.node().select();
		do_search(data);
	}

	var prev_ser_state = "";
	function update_url(state) {
		prev_ser_state = state || serialize_state();
		window.location.hash = encodeURIComponent(prev_ser_state);
	};

	function update_from_url() {
		var data = decodeURIComponent(window.location.hash.substr(1));
		if (data != prev_ser_state) {
			prev_ser_state = data;
			deserialize_state(data);
			return true;
		}
		return false;
	}

	d3.select(window).on("load", init);
})();
