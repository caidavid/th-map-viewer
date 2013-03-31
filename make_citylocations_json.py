import json

f = file('CityLocations.txt', 'r')
foundations = []
for line in f:
	coords = line.strip().split(",")
	f = {
		"x": int(coords[0]),
		"y": int(coords[1])
	}
	foundations.append(f)

print json.dumps(foundations, indent=4)
