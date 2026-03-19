export const VOIVODESHIPS: Record<string, string[]> = {
  "dolnośląskie": ["Wrocław", "Wałbrzych", "Legnica", "Jelenia Góra", "Lubin", "Głogów", "Świdnica", "Bolesławiec", "Oleśnica", "Dzierżoniów"],
  "kujawsko-pomorskie": ["Bydgoszcz", "Toruń", "Włocławek", "Grudziądz", "Inowrocław", "Brodnica", "Świecie", "Chełmno", "Nakło nad Notecią", "Żnin"],
  "lubelskie": ["Lublin", "Zamość", "Chełm", "Biała Podlaska", "Puławy", "Świdnik", "Łuków", "Kraśnik", "Lubartów", "Tomaszów Lubelski"],
  "lubuskie": ["Zielona Góra", "Gorzów Wielkopolski", "Nowa Sól", "Żary", "Żagań", "Świebodzin", "Międzyrzecz", "Sulęcin", "Gubin", "Kostrzyn nad Odrą"],
  "łódzkie": ["Łódź", "Piotrków Trybunalski", "Pabianice", "Tomaszów Mazowiecki", "Bełchatów", "Zgierz", "Skierniewice", "Radomsko", "Kutno", "Sieradz"],
  "małopolskie": ["Kraków", "Tarnów", "Nowy Sącz", "Oświęcim", "Chrzanów", "Olkusz", "Zakopane", "Bochnia", "Gorlice", "Wieliczka"],
  "mazowieckie": ["Warszawa", "Radom", "Płock", "Siedlce", "Pruszków", "Legionowo", "Ostrołęka", "Ciechanów", "Piaseczno", "Wołomin"],
  "opolskie": ["Opole", "Kędzierzyn-Koźle", "Nysa", "Brzeg", "Kluczbork", "Prudnik", "Strzelce Opolskie", "Namysłów", "Głubczyce", "Krapkowice"],
  "podkarpackie": ["Rzeszów", "Przemyśl", "Stalowa Wola", "Mielec", "Krosno", "Tarnobrzeg", "Sanok", "Jarosław", "Jasło", "Dębica"],
  "podlaskie": ["Białystok", "Suwałki", "Łomża", "Augustów", "Bielsk Podlaski", "Hajnówka", "Zambrów", "Grajewo", "Sokółka", "Kolno"],
  "pomorskie": ["Gdańsk", "Gdynia", "Słupsk", "Tczew", "Starogard Gdański", "Wejherowo", "Rumia", "Chojnice", "Sopot", "Kościerzyna"],
  "śląskie": ["Katowice", "Częstochowa", "Sosnowiec", "Gliwice", "Zabrze", "Bytom", "Bielsko-Biała", "Rybnik", "Tychy", "Dąbrowa Górnicza"],
  "świętokrzyskie": ["Kielce", "Ostrowiec Świętokrzyski", "Starachowice", "Skarżysko-Kamienna", "Sandomierz", "Końskie", "Busko-Zdrój", "Jędrzejów", "Włoszczowa", "Pińczów"],
  "warmińsko-mazurskie": ["Olsztyn", "Elbląg", "Ełk", "Ostróda", "Iława", "Giżycko", "Kętrzyn", "Szczytno", "Bartoszyce", "Mrągowo"],
  "wielkopolskie": ["Poznań", "Kalisz", "Konin", "Piła", "Ostrów Wielkopolski", "Gniezno", "Leszno", "Luboń", "Swarzędz", "Śrem"],
  "zachodniopomorskie": ["Szczecin", "Koszalin", "Stargard", "Kołobrzeg", "Świnoujście", "Police", "Wałcz", "Białogard", "Gryfice", "Goleniów"],
};

export const VOIVODESHIP_NAMES = Object.keys(VOIVODESHIPS);

export const ALL_CITIES = Object.values(VOIVODESHIPS).flat();

export const CITY_TO_VOIVODESHIP: Record<string, string> = {};
for (const [v, cities] of Object.entries(VOIVODESHIPS)) {
  for (const c of cities) {
    CITY_TO_VOIVODESHIP[c] = v;
  }
}

export const CITY_COORDS: Record<string, [number, number]> = {
  "Warszawa": [52.2297, 21.0122], "Kraków": [50.0647, 19.9450], "Wrocław": [51.1079, 17.0385],
  "Poznań": [52.4064, 16.9252], "Gdańsk": [54.3520, 18.6466], "Łódź": [51.7592, 19.4560],
  "Katowice": [50.2599, 19.0216], "Szczecin": [53.4285, 14.5528], "Bydgoszcz": [53.1235, 17.9941],
  "Lublin": [51.2465, 22.5684], "Białystok": [53.1325, 23.1688], "Gdynia": [54.5189, 18.5305],
  "Częstochowa": [50.8118, 19.1203], "Radom": [51.4027, 21.1471], "Sosnowiec": [50.2863, 19.1042],
  "Toruń": [53.0138, 18.5981], "Kielce": [50.8661, 20.6286], "Rzeszów": [50.0412, 21.9991],
  "Gliwice": [50.2945, 18.6714], "Zabrze": [50.3249, 18.7857], "Olsztyn": [53.7784, 20.4801],
  "Bielsko-Biała": [49.8224, 19.0587], "Bytom": [50.3483, 18.9156], "Zielona Góra": [51.9356, 15.5062],
  "Rybnik": [50.0971, 18.5463], "Ruda Śląska": [50.2584, 18.8553], "Opole": [50.6751, 17.9213],
  "Tychy": [50.1369, 18.9997], "Dąbrowa Górnicza": [50.3217, 19.1872], "Płock": [52.5464, 19.7064],
  "Elbląg": [54.1561, 19.4044], "Tarnów": [50.0121, 20.9858], "Chorzów": [50.2975, 18.9549],
  "Koszalin": [54.1943, 16.1714], "Kalisz": [51.7613, 18.0910], "Legnica": [51.2100, 16.1619],
  "Nowy Sącz": [49.6218, 20.6972], "Grudziądz": [53.4837, 18.7536], "Jaworzno": [50.2052, 19.2752],
  "Słupsk": [54.4641, 17.0285], "Jastrzębie-Zdrój": [49.9513, 18.5932], "Nowy Targ": [49.4776, 20.0325],
  "Konin": [52.2230, 18.2510], "Piła": [53.1510, 16.7383], "Ostrów Wielkopolski": [51.6544, 17.8066],
  "Pabianice": [51.6647, 19.3544], "Wałbrzych": [50.7714, 16.2843], "Tczew": [54.0927, 18.7798],
  "Siedlce": [52.1676, 22.2903], "Przemyśl": [49.7838, 22.7676], "Mielec": [50.2872, 21.4251],
  "Stalowa Wola": [50.5826, 22.0537], "Oświęcim": [50.0343, 19.2097], "Zamość": [50.7231, 23.2519],
  "Suwałki": [54.1118, 22.9308], "Chełm": [51.1432, 23.4716], "Łomża": [53.1782, 22.0590],
  "Gniezno": [52.5347, 17.5826], "Leszno": [51.8417, 16.5750], "Sopot": [54.4417, 18.5601],
  "Starogard Gdański": [53.9627, 18.5308], "Ostrołęka": [53.0842, 21.5736], "Pruszków": [52.1708, 20.8118],
  "Żary": [51.6384, 15.1339], "Nowa Sól": [51.8061, 15.7147], "Jelenia Góra": [50.9044, 15.7197],
  "Świdnica": [50.8432, 16.4872], "Chrzanów": [50.1356, 19.4049], "Olkusz": [50.2816, 19.5683],
  "Zakopane": [49.2992, 19.9496], "Sandomierz": [50.6826, 21.7489],
  "Gorzów Wielkopolski": [52.7325, 15.2369], "Kędzierzyn-Koźle": [50.3494, 18.2132],
  "Krosno": [49.6939, 21.7705], "Nysa": [50.4733, 17.3342],
  "Wejherowo": [54.6059, 18.2355], "Rumia": [54.5710, 18.3936],
  "Biała Podlaska": [52.0324, 23.1162], "Puławy": [51.4166, 21.9694],
  "Augustów": [53.8438, 22.9803], "Bielsk Podlaski": [52.7660, 23.1868],
  "Stargard": [53.3345, 15.0503], "Kołobrzeg": [54.1762, 15.5762],
  "Świnoujście": [53.9103, 14.2470], "Chojnice": [53.6962, 17.5578],
  "Piotrków Trybunalski": [51.4053, 19.6826], "Tomaszów Mazowiecki": [51.5311, 20.0089],
  "Bełchatów": [51.3618, 19.3569], "Zgierz": [51.8553, 19.4069], "Skierniewice": [51.9537, 20.1434],
  "Ciechanów": [52.8819, 20.6208], "Piaseczno": [52.0725, 21.0244], "Legionowo": [52.4013, 20.9259],
  "Inowrocław": [52.7962, 18.2568], "Włocławek": [52.6483, 19.0677],
  "Bochnia": [49.9691, 20.4316], "Wieliczka": [49.9873, 20.0641],
  "Ostrowiec Świętokrzyski": [50.9294, 21.3855], "Starachowice": [51.0389, 21.0744],
  "Skarżysko-Kamienna": [51.1130, 20.8604], "Końskie": [51.1928, 20.4154],
  "Ełk": [53.8282, 22.3647], "Ostróda": [53.6960, 19.9678],
  "Iława": [53.5957, 19.5680], "Giżycko": [54.0381, 21.7689],
};
