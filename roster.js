// Roads of Rogue — AI-generated roster. Written by tools/generate.mjs. Edit via the generator.
window.ROSTER = {
  "version": 1,
  "weapons": [
    {
      "id": "bat-carnival",
      "name": "Carnival Bat",
      "kind": "melee",
      "head": "bat",
      "tier": 2,
      "color": "a",
      "fx": "none"
    },
    {
      "id": "pipe-carnival",
      "name": "Pipe of Panic",
      "kind": "melee",
      "head": "pipe",
      "tier": 2,
      "color": "b",
      "fx": "sparks"
    },
    {
      "id": "dartgun-haunted",
      "name": "Haunted Dartgun",
      "kind": "gun",
      "head": "dartgun",
      "tier": 1,
      "color": "c",
      "fx": "none"
    }
  ],
  "enemies": [
    {
      "id": "carnival-barker",
      "name": "Carnival Barker",
      "behavior": "rusher",
      "palette": "neon",
      "sizeTier": "m",
      "hpTier": "normal",
      "parts": [
        {
          "item": "cap",
          "slot": "hat",
          "size": "m",
          "color": "a"
        },
        {
          "item": "beard",
          "slot": "face",
          "size": "s",
          "color": "dark"
        },
        {
          "item": "badge",
          "slot": "chest",
          "size": "m",
          "color": "b"
        },
        {
          "item": "cape",
          "slot": "back",
          "size": "l",
          "color": "c"
        }
      ],
      "onHit": "blood",
      "aura": "none",
      "weapon": "bat-carnival"
    },
    {
      "id": "clown-carny",
      "name": "Clown Carny",
      "behavior": "rusher",
      "palette": "candy",
      "sizeTier": "m",
      "hpTier": "normal",
      "parts": [
        {
          "item": "cone",
          "slot": "hat",
          "size": "m",
          "color": "a"
        },
        {
          "item": "mask",
          "slot": "face",
          "size": "m",
          "color": "b"
        },
        {
          "item": "ruff",
          "slot": "neck",
          "size": "m",
          "color": "c"
        },
        {
          "item": "bandolier",
          "slot": "chest",
          "size": "m",
          "color": "skin"
        }
      ],
      "onHit": "confetti",
      "aura": "none",
      "weapon": "pipe-carnival"
    },
    {
      "id": "sideshow-illusionist",
      "name": "Sideshow Illusionist",
      "behavior": "shooter",
      "palette": "violet",
      "sizeTier": "m",
      "hpTier": "normal",
      "parts": [
        {
          "item": "tophat",
          "slot": "hat",
          "size": "m",
          "color": "a"
        },
        {
          "item": "shades",
          "slot": "face",
          "size": "m",
          "color": "b"
        },
        {
          "item": "cape",
          "slot": "back",
          "size": "m",
          "color": "c"
        },
        {
          "item": "belt",
          "slot": "waist",
          "size": "m",
          "color": "dark"
        }
      ],
      "onHit": "blood",
      "aura": "none",
      "weapon": "dartgun-haunted"
    },
    {
      "id": "carnival-roller",
      "name": "Carnival Roller",
      "behavior": "bruiser",
      "palette": "rust",
      "sizeTier": "l",
      "hpTier": "tough",
      "parts": [
        {
          "item": "hardhat",
          "slot": "hat",
          "size": "m",
          "color": "a"
        },
        {
          "item": "vest",
          "slot": "chest",
          "size": "l",
          "color": "b"
        },
        {
          "item": "boots",
          "slot": "foot",
          "size": "l",
          "color": "c"
        },
        {
          "item": "tank",
          "slot": "back",
          "size": "m",
          "color": "dark"
        }
      ],
      "onHit": "blood",
      "aura": "none",
      "weapon": "bat-carnival"
    },
    {
      "id": "wraith-carny",
      "name": "Wraith Carny",
      "behavior": "bruiser",
      "palette": "noir",
      "sizeTier": "l",
      "hpTier": "boss",
      "parts": [
        {
          "item": "bald",
          "slot": "head",
          "size": "l",
          "color": "skin"
        },
        {
          "item": "warpaint",
          "slot": "face",
          "size": "m",
          "color": "a"
        },
        {
          "item": "jersey",
          "slot": "chest",
          "size": "l",
          "color": "b"
        },
        {
          "item": "wings",
          "slot": "back",
          "size": "l",
          "color": "c"
        }
      ],
      "onHit": "blood",
      "aura": "glow",
      "weapon": "pipe-carnival"
    }
  ],
  "places": [
    {
      "id": "twisted-mirror-arcade",
      "name": "Twisted Mirror Arcade",
      "biome": "city",
      "kind": "arcade",
      "floor": "tile",
      "wall": "block",
      "layout": "split",
      "fixtures": [
        {
          "item": "arcade",
          "along": "center",
          "count": 2
        },
        {
          "item": "shelf",
          "along": "wall",
          "count": 3
        },
        {
          "item": "tv",
          "along": "corner",
          "count": 1
        },
        {
          "item": "couch",
          "along": "center",
          "count": 1
        },
        {
          "item": "crate",
          "along": "wall",
          "count": 4
        }
      ],
      "occupants": [
        "civ",
        "civ",
        "civ",
        "civ"
      ],
      "loot": [
        "cash",
        "health"
      ],
      "sign": "painted"
    },
    {
      "id": "haunted-midway",
      "name": "The Haunted Midway",
      "biome": "city",
      "kind": "warehouse",
      "floor": "concrete",
      "wall": "brick",
      "layout": "backroom",
      "fixtures": [
        {
          "item": "table",
          "along": "center",
          "count": 1
        },
        {
          "item": "barrel",
          "along": "wall",
          "count": 3
        },
        {
          "item": "crate",
          "along": "wall",
          "count": 4
        },
        {
          "item": "shelf",
          "along": "wall",
          "count": 2
        }
      ],
      "occupants": [
        "carnival-barker",
        "clown-carny",
        "sideshow-illusionist"
      ],
      "loot": [
        "cash",
        "bat-carnival",
        "health"
      ],
      "sign": "painted"
    },
    {
      "id": "carnival-witch-hut",
      "name": "The Witch's Tent",
      "biome": "city",
      "kind": "shop",
      "floor": "carpet",
      "wall": "wood",
      "layout": "open",
      "fixtures": [
        {
          "item": "counter",
          "along": "wall",
          "count": 1
        },
        {
          "item": "shelf",
          "along": "wall",
          "count": 3
        },
        {
          "item": "chair",
          "along": "center",
          "count": 2
        },
        {
          "item": "crate",
          "along": "center",
          "count": 2
        }
      ],
      "occupants": [
        "civ",
        "civ",
        "civ"
      ],
      "loot": [
        "cash",
        "health"
      ],
      "sign": "painted"
    }
  ]
};
