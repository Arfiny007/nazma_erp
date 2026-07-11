/**
 * Official Bangladesh administrative geography — 8 divisions, 64 districts.
 *
 * Source: Government of Bangladesh administrative structure (as of 2024).
 * Codes are stable ASCII slugs used as upsert keys in the seed script.
 */

export interface DivisionSeed {
  code: string;
  name: string;
  nameBn: string;
  sortOrder: number;
}

export interface DistrictSeed {
  code: string;
  name: string;
  nameBn: string;
  divisionCode: string;
  sortOrder: number;
}

export const DIVISIONS: DivisionSeed[] = [
  { code: "barishal", name: "Barishal", nameBn: "বরিশাল", sortOrder: 1 },
  { code: "chattogram", name: "Chattogram", nameBn: "চট্টগ্রাম", sortOrder: 2 },
  { code: "dhaka", name: "Dhaka", nameBn: "ঢাকা", sortOrder: 3 },
  { code: "khulna", name: "Khulna", nameBn: "খুলনা", sortOrder: 4 },
  { code: "mymensingh", name: "Mymensingh", nameBn: "ময়মনসিংহ", sortOrder: 5 },
  { code: "rajshahi", name: "Rajshahi", nameBn: "রাজশাহী", sortOrder: 6 },
  { code: "rangpur", name: "Rangpur", nameBn: "রংপুর", sortOrder: 7 },
  { code: "sylhet", name: "Sylhet", nameBn: "সিলেট", sortOrder: 8 },
];

export const DISTRICTS: DistrictSeed[] = [
  { code: "barguna", name: "Barguna", nameBn: "বরগুনা", divisionCode: "barishal", sortOrder: 1 },
  { code: "barishal", name: "Barishal", nameBn: "বরিশাল", divisionCode: "barishal", sortOrder: 2 },
  { code: "bhola", name: "Bhola", nameBn: "ভোলা", divisionCode: "barishal", sortOrder: 3 },
  { code: "jhalokati", name: "Jhalokati", nameBn: "ঝালকাঠি", divisionCode: "barishal", sortOrder: 4 },
  { code: "patuakhali", name: "Patuakhali", nameBn: "পটুয়াখালী", divisionCode: "barishal", sortOrder: 5 },
  { code: "pirojpur", name: "Pirojpur", nameBn: "পিরোজপুর", divisionCode: "barishal", sortOrder: 6 },
  { code: "bandarban", name: "Bandarban", nameBn: "বান্দরবান", divisionCode: "chattogram", sortOrder: 1 },
  { code: "brahmanbaria", name: "Brahmanbaria", nameBn: "ব্রাহ্মণবাড়িয়া", divisionCode: "chattogram", sortOrder: 2 },
  { code: "chandpur", name: "Chandpur", nameBn: "চাঁদপুর", divisionCode: "chattogram", sortOrder: 3 },
  { code: "chattogram", name: "Chattogram", nameBn: "চট্টগ্রাম", divisionCode: "chattogram", sortOrder: 4 },
  { code: "cumilla", name: "Cumilla", nameBn: "কুমিল্লা", divisionCode: "chattogram", sortOrder: 5 },
  { code: "coxs-bazar", name: "Cox's Bazar", nameBn: "কক্সবাজার", divisionCode: "chattogram", sortOrder: 6 },
  { code: "feni", name: "Feni", nameBn: "ফেনী", divisionCode: "chattogram", sortOrder: 7 },
  { code: "khagrachhari", name: "Khagrachhari", nameBn: "খাগড়াছড়ি", divisionCode: "chattogram", sortOrder: 8 },
  { code: "lakshmipur", name: "Lakshmipur", nameBn: "লক্ষ্মীপুর", divisionCode: "chattogram", sortOrder: 9 },
  { code: "noakhali", name: "Noakhali", nameBn: "নোয়াখালী", divisionCode: "chattogram", sortOrder: 10 },
  { code: "rangamati", name: "Rangamati", nameBn: "রাঙ্গামাটি", divisionCode: "chattogram", sortOrder: 11 },
  { code: "dhaka", name: "Dhaka", nameBn: "ঢাকা", divisionCode: "dhaka", sortOrder: 1 },
  { code: "faridpur", name: "Faridpur", nameBn: "ফরিদপুর", divisionCode: "dhaka", sortOrder: 2 },
  { code: "gazipur", name: "Gazipur", nameBn: "গাজীপুর", divisionCode: "dhaka", sortOrder: 3 },
  { code: "gopalganj", name: "Gopalganj", nameBn: "গোপালগঞ্জ", divisionCode: "dhaka", sortOrder: 4 },
  { code: "kishoreganj", name: "Kishoreganj", nameBn: "কিশোরগঞ্জ", divisionCode: "dhaka", sortOrder: 5 },
  { code: "madaripur", name: "Madaripur", nameBn: "মাদারীপুর", divisionCode: "dhaka", sortOrder: 6 },
  { code: "manikganj", name: "Manikganj", nameBn: "মানিকগঞ্জ", divisionCode: "dhaka", sortOrder: 7 },
  { code: "munshiganj", name: "Munshiganj", nameBn: "মুন্সিগঞ্জ", divisionCode: "dhaka", sortOrder: 8 },
  { code: "narayanganj", name: "Narayanganj", nameBn: "নারায়ণগঞ্জ", divisionCode: "dhaka", sortOrder: 9 },
  { code: "narsingdi", name: "Narsingdi", nameBn: "নরসিংদী", divisionCode: "dhaka", sortOrder: 10 },
  { code: "rajbari", name: "Rajbari", nameBn: "রাজবাড়ী", divisionCode: "dhaka", sortOrder: 11 },
  { code: "shariatpur", name: "Shariatpur", nameBn: "শরীয়তপুর", divisionCode: "dhaka", sortOrder: 12 },
  { code: "tangail", name: "Tangail", nameBn: "টাঙ্গাইল", divisionCode: "dhaka", sortOrder: 13 },
  { code: "bagerhat", name: "Bagerhat", nameBn: "বাগেরহাট", divisionCode: "khulna", sortOrder: 1 },
  { code: "chuadanga", name: "Chuadanga", nameBn: "চুয়াডাঙ্গা", divisionCode: "khulna", sortOrder: 2 },
  { code: "jashore", name: "Jashore", nameBn: "যশোর", divisionCode: "khulna", sortOrder: 3 },
  { code: "jhenaidah", name: "Jhenaidah", nameBn: "ঝিনাইদহ", divisionCode: "khulna", sortOrder: 4 },
  { code: "khulna", name: "Khulna", nameBn: "খুলনা", divisionCode: "khulna", sortOrder: 5 },
  { code: "kushtia", name: "Kushtia", nameBn: "কুষ্টিয়া", divisionCode: "khulna", sortOrder: 6 },
  { code: "magura", name: "Magura", nameBn: "মাগুরা", divisionCode: "khulna", sortOrder: 7 },
  { code: "meherpur", name: "Meherpur", nameBn: "মেহেরপুর", divisionCode: "khulna", sortOrder: 8 },
  { code: "narail", name: "Narail", nameBn: "নড়াইল", divisionCode: "khulna", sortOrder: 9 },
  { code: "satkhira", name: "Satkhira", nameBn: "সাতক্ষীরা", divisionCode: "khulna", sortOrder: 10 },
  { code: "jamalpur", name: "Jamalpur", nameBn: "জামালপুর", divisionCode: "mymensingh", sortOrder: 1 },
  { code: "mymensingh", name: "Mymensingh", nameBn: "ময়মনসিংহ", divisionCode: "mymensingh", sortOrder: 2 },
  { code: "netrokona", name: "Netrokona", nameBn: "নেত্রকোণা", divisionCode: "mymensingh", sortOrder: 3 },
  { code: "sherpur", name: "Sherpur", nameBn: "শেরপুর", divisionCode: "mymensingh", sortOrder: 4 },
  { code: "bogura", name: "Bogura", nameBn: "বগুড়া", divisionCode: "rajshahi", sortOrder: 1 },
  { code: "chapainawabganj", name: "Chapainawabganj", nameBn: "চাঁপাইনবাবগঞ্জ", divisionCode: "rajshahi", sortOrder: 2 },
  { code: "joypurhat", name: "Joypurhat", nameBn: "জয়পুরহাট", divisionCode: "rajshahi", sortOrder: 3 },
  { code: "naogaon", name: "Naogaon", nameBn: "নওগাঁ", divisionCode: "rajshahi", sortOrder: 4 },
  { code: "natore", name: "Natore", nameBn: "নাটোর", divisionCode: "rajshahi", sortOrder: 5 },
  { code: "pabna", name: "Pabna", nameBn: "পাবনা", divisionCode: "rajshahi", sortOrder: 6 },
  { code: "rajshahi", name: "Rajshahi", nameBn: "রাজশাহী", divisionCode: "rajshahi", sortOrder: 7 },
  { code: "sirajganj", name: "Sirajganj", nameBn: "সিরাজগঞ্জ", divisionCode: "rajshahi", sortOrder: 8 },
  { code: "dinajpur", name: "Dinajpur", nameBn: "দিনাজপুর", divisionCode: "rangpur", sortOrder: 1 },
  { code: "gaibandha", name: "Gaibandha", nameBn: "গাইবান্ধা", divisionCode: "rangpur", sortOrder: 2 },
  { code: "kurigram", name: "Kurigram", nameBn: "কুড়িগ্রাম", divisionCode: "rangpur", sortOrder: 3 },
  { code: "lalmonirhat", name: "Lalmonirhat", nameBn: "লালমনিরহাট", divisionCode: "rangpur", sortOrder: 4 },
  { code: "nilphamari", name: "Nilphamari", nameBn: "নীলফামারী", divisionCode: "rangpur", sortOrder: 5 },
  { code: "panchagarh", name: "Panchagarh", nameBn: "পঞ্চগড়", divisionCode: "rangpur", sortOrder: 6 },
  { code: "rangpur", name: "Rangpur", nameBn: "রংপুর", divisionCode: "rangpur", sortOrder: 7 },
  { code: "thakurgaon", name: "Thakurgaon", nameBn: "ঠাকুরগাঁও", divisionCode: "rangpur", sortOrder: 8 },
  { code: "habiganj", name: "Habiganj", nameBn: "হবিগঞ্জ", divisionCode: "sylhet", sortOrder: 1 },
  { code: "moulvibazar", name: "Moulvibazar", nameBn: "মৌলভীবাজার", divisionCode: "sylhet", sortOrder: 2 },
  { code: "sunamganj", name: "Sunamganj", nameBn: "সুনামগঞ্জ", divisionCode: "sylhet", sortOrder: 3 },
  { code: "sylhet", name: "Sylhet", nameBn: "সিলেট", divisionCode: "sylhet", sortOrder: 4 },
];
