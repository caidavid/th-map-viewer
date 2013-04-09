import os
import ujson as json
from datetime import datetime, timedelta
# -1 hour: Troops
# -24 hour: Strongholds, Tribes

def json_from_file(filename):
	try:
		f = open(filename, "r")
		data = json.load(f)
		f.close()
		return data
	except:
		return None

def format_date_str(dt):
	return "{0}{1:02}{2:02}T{3:02}{4:02}".format(dt.year, dt.month, dt.day, dt.hour, dt.minute)

def rename_file(filename):
	data = json_from_file(filename)
	if date is None:
		print "failed to rename", filename
		return
	dt = datetime.strptime(data["SnapshotBegin"][0:-2]+"UTC", "%Y-%m-%dT%H:%M:%S.%f%Z")
	newdatestr = format_date_str(dt)
	newname = "map" + newdatestr + ".json"
	os.rename(filename, newname)
	print(filename + " => " + newname)

# rename old files
print "Renaming json files"
for filename in filter(lambda x: x.startswith("map_2") and x.endswith(".json"), os.listdir(".")):
	rename_file(filename)

# load map.json
print "Loading map.json"
cur_data = json_from_file("map.json")
dt = datetime.strptime(cur_data["SnapshotBegin"][0:-2]+"UTC", "%Y-%m-%dT%H:%M:%S.%f%Z")

# load previous troops
print "Loading troops"
prev_troops_dt = dt - timedelta(hours = 1)
prev_troops_filename = "map" + format_date_str(prev_troops_dt) + ".json"
troops = json_from_file(prev_troops_filename)["Troops"]
if troops is None:
	troops = []

# find previous strongholds
print "Loading strongholds"
cur_strongholds = cur_data["Strongholds"]
ch_strongholds = []

for h in range(1, 25):
	prev_sh_dt = dt - timedelta(hours = h)
	prev_sh_filename = "map" + format_date_str(prev_sh_dt) + ".json"
	prev_data = json_from_file(prev_sh_filename)
	if prev_data is None:
		continue
	prev_strongholds = prev_data["Strongholds"]
	for prev_sh in prev_strongholds:
		cur = [x for x in cur_strongholds if x["id"] == prev_sh["id"]]
		if len(cur) != 0 and prev_sh["tribeId"] != cur[0]["tribeId"]:
			prev_sh["time"] = prev_sh_dt.isoformat() + "Z"
			ch_strongholds.append(prev_sh)
	cur_strongholds = prev_strongholds

print len(ch_strongholds), "changes"

prev_map = {
	"Troops": troops,
	"Strongholds": ch_strongholds
}

print "Writing map_prev.json"
fo = open("map_prev.json", "w")
json.dump(prev_map, fo)
fo.close()

print "Done"
