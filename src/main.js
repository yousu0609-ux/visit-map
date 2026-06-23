import './style.css'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import exifr from 'exifr'

document.querySelector('#app').innerHTML = `
  <div class="container">
    <h1>전국 방문지 기록</h1>

    <input type="file" id="photoInput" multiple accept="image/*">

<div class="stats">
  <div>등록 사진: <strong id="photoCount">0</strong>장</div>
  <div>방문 지역: <strong id="regionCount">0</strong>곳</div>
  <div>전국 방문률: <strong id="visitRate">0%</strong></div>
</div>

<h2>장소 앨범</h2>
<div id="albumList"></div>

<h2>✈️ 여행 목록</h2>
<div id="tripList"></div>

<div id="albumViewer"></div>

<h2>방문 지역</h2>
<ul id="regionList"></ul>

<div id="map"></div>

    <h2>등록된 사진</h2>
    <ul id="photoList"></ul>
  </div>
`

const map = L.map('map').setView([36.5, 127.8], 7)

const photoIcon = L.divIcon({
  className: 'photo-marker',
  html: '📍',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
})

const photoList = document.getElementById('photoList')

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map)

async function getAddress(latitude, longitude) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ko`
  )

  const data = await response.json()
  const address = data.address || {}

  const province =
    address.province ||
    address.state ||
    ''

  const city =
    address.city ||
    address.town ||
    address.county ||
    address.municipality ||
    ''

  const district =
    address.borough ||
    address.suburb ||
    address.village ||
    ''

  return {
    province,
    city,
    district,
    displayName: [province, city, district].filter(Boolean).join(' ')
  }
}

function createThumbnailDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const img = new Image()

      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxSize = 300

        let width = img.width
        let height = img.height

        if (width > height) {
          height = height * (maxSize / width)
          width = maxSize
        } else {
          width = width * (maxSize / height)
          height = maxSize
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }

      img.onerror = reject
      img.src = reader.result
    }

    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000

  const toRadians = degrees =>
    degrees * Math.PI / 180

  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2)

  const c =
    2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadius * c
}

async function getLandmark(latitude, longitude) {
  const query = `
    [out:json];
    (
      node(around:1000,${latitude},${longitude})["tourism"];
      node(around:1000,${latitude},${longitude})["historic"];
      node(around:1000,${latitude},${longitude})["leisure"];
    );
    out center 10;
  `

  const response = await fetch(
    'https://overpass-api.de/api/interpreter',
    {
      method: 'POST',
      body: query
    }
  )

  const data = await response.json()

  const places = data.elements
    .filter(place => place.tags && place.tags.name)
    .map(place => {
      const distance = getDistanceMeters(
        latitude,
        longitude,
        place.lat,
        place.lon
      )

      return {
        name: place.tags.name,
        distance
      }
    })
    .sort((a, b) => a.distance - b.distance)

  return places[0]?.name || ''
}

function updateStats() {
  const photoCount = document.getElementById('photoCount')
  const regionCount = document.getElementById('regionCount')
  const regionList = document.getElementById('regionList')
  const visitRate = document.getElementById('visitRate')

  photoCount.textContent = savedPhotos.length

  const regions = [...new Set(
    savedPhotos
      .map(photo => photo.address)
      .filter(Boolean)
  )]

  regionCount.textContent = regions.length

  const rate =
    ((regions.length / 229) * 100).toFixed(1)

  visitRate.textContent = `${rate}%`

  regionList.innerHTML = ''

  regions.forEach(region => {
    const listItem = document.createElement('li')
    listItem.textContent = region
    regionList.appendChild(listItem)
  })
}

function getAlbumDateText(photos) {
  const dates = photos
    .map(photo => photo.takenAt)
    .filter(Boolean)

  if (dates.length === 0) {
    return '날짜 정보 없음'
  }

  const uniqueDates = [...new Set(dates)]

  if (uniqueDates.length === 1) {
    return uniqueDates[0]
  }

  return `${uniqueDates[0]} ~ ${uniqueDates[uniqueDates.length - 1]}`
}

function updateAlbums() {
  const albumList = document.getElementById('albumList')

  albumList.innerHTML = ''

  const albums = []
  const radiusMeters = 300

  savedPhotos.forEach(photo => {
    let matchedAlbum = null

    for (const album of albums) {
      const distance = getDistanceMeters(
        photo.latitude,
        photo.longitude,
        album.centerLatitude,
        album.centerLongitude
      )

      if (distance <= radiusMeters) {
        matchedAlbum = album
        break
      }
    }

    if (matchedAlbum) {
      matchedAlbum.photos.push(photo)
    } else {
      albums.push({
  title: photo.landmarkName || photo.address || '알 수 없는 장소',
  centerLatitude: photo.latitude,
  centerLongitude: photo.longitude,
  photos: [photo]
})
    }
  })

  albums.forEach(album => {
    const albumCard = document.createElement('div')
    albumCard.className = 'album-card'

    const coverPhoto = album.photos[0]

albumCard.innerHTML = `
  <div class="album-cover">
    ${
      coverPhoto?.thumbnailUrl
        ? `<img src="${coverPhoto.thumbnailUrl}" alt="${album.title}">`
        : `<div class="album-cover-placeholder">📍</div>`
    }
  </div>

  <div class="album-info">
    <h3>📍 ${album.title}</h3>
    <p>${getAlbumDateText(album.photos)}</p>
    <p>사진 ${album.photos.length}장</p>
  </div>
`

albumCard.style.cursor = 'pointer'

albumCard.addEventListener('click', () => {
  openAlbum(album)
})

    albumList.appendChild(albumCard)
  })
}

function updateTrips() {

  const tripList =
    document.getElementById('tripList')

  tripList.innerHTML = ''

  const trips = {}

  savedPhotos.forEach(photo => {

    if (!photo.takenAt) return

    const city =
      (photo.address || '')
        .split(' ')
        .slice(0, 2)
        .join(' ')

    const key =
      `${photo.takenAt}-${city}`

    if (!trips[key]) {
      trips[key] = []
    }

    trips[key].push(photo)

  })

  Object.entries(trips).forEach(
    ([key, photos]) => {

      const tripCard =
        document.createElement('div')

      tripCard.className =
        'album-card'

      const first =
        photos[0]

      tripCard.innerHTML = `
        <h3>✈️ ${key}</h3>
        <p>장소 ${new Set(
          photos.map(
            p => p.landmarkName || p.address
          )
        ).size}곳</p>

        <p>사진 ${photos.length}장</p>
      `

      tripList.appendChild(tripCard)

    }
  )
}

function openAlbum(album) {

  map.setView([album.centerLatitude, album.centerLongitude], 15)

  const albumViewer =
    document.getElementById('albumViewer')

  albumViewer.innerHTML = `
    <h2>${album.title}</h2>

    <div class="album-photos">
      ${album.photos.map(photo => `
        <img src="${photo.thumbnailUrl}">
      `).join('')}
    </div>
  `
}

function deletePhoto(index) {
  savedPhotos.splice(index, 1)

  localStorage.setItem(
    'visitedPhotos',
    JSON.stringify(savedPhotos)
  )

  location.reload()
}

const photoInput = document.getElementById('photoInput')

const savedPhotos =
  JSON.parse(localStorage.getItem('visitedPhotos')) || []

savedPhotos.forEach((photo, index) => {

  L.marker([
    photo.latitude,
    photo.longitude
  ], { icon: photoIcon })
  .addTo(map)
  .bindPopup(`
  <div>
    ${photo.thumbnailUrl ? `<img src="${photo.thumbnailUrl}" style="width:160px; border-radius:8px; margin-bottom:8px;">` : ''}
    <strong>${photo.name}</strong><br>
    ${photo.address || `${photo.latitude}, ${photo.longitude}`}
  </div>
`)

  const listItem = document.createElement('li')

listItem.innerHTML = `
  <div class="photo-card">
    ${photo.thumbnailUrl ? `<img src="${photo.thumbnailUrl}" alt="${photo.name}">` : ''}
    <div>
      <strong>${photo.name}</strong><br>
${photo.takenAt ? `${photo.takenAt}<br>` : ''}
${photo.address || `${photo.latitude}, ${photo.longitude}`}<br>
      <button data-index="${index}">삭제</button>
    </div>
  </div>
`

listItem.querySelector('button').addEventListener('click', () => {
  deletePhoto(index)
})

photoList.appendChild(listItem)

})

updateStats()
updateAlbums()
updateTrips()

photoInput.addEventListener('change', async (event) => {

  const files = event.target.files

  for (const file of files) {

    try {

      const gps = await exifr.gps(file)
      const exifData = await exifr.parse(file)
const takenAt =
  exifData?.DateTimeOriginal
    ? new Date(exifData.DateTimeOriginal).toLocaleDateString('ko-KR')
    : ''

      console.log(file.name)
      console.log(gps)

let address = { displayName: '' }

try {
  address = await getAddress(gps.latitude, gps.longitude)
  console.log(address)
} catch (error) {
  console.log('주소 변환 실패', error)
}

let landmarkName = ''

try {
  landmarkName = await getLandmark(gps.latitude, gps.longitude)
  console.log('랜드마크:', landmarkName)
} catch (error) {
  console.log('랜드마크 검색 실패', error)
}

const imageUrl = URL.createObjectURL(file)
const thumbnailUrl = await createThumbnailDataUrl(file)

L.marker([
  gps.latitude,
  gps.longitude
], { icon: photoIcon })
.addTo(map)
.bindPopup(`
  <div>
    <img src="${thumbnailUrl}" style="width:160px; border-radius:8px; margin-bottom:8px;"><br>
    <strong>${file.name}</strong><br>
    ${address.displayName || `${gps.latitude}, ${gps.longitude}`}
  </div>
`)

map.setView([gps.latitude, gps.longitude], 13)

const listItem = document.createElement('li')

listItem.innerHTML = `
  <div class="photo-card">
    <img src="${thumbnailUrl}" alt="${file.name}">
    <div>
      <strong>${file.name}</strong><br>
${takenAt ? `${takenAt}<br>` : ''}
${address.displayName || `${gps.latitude}, ${gps.longitude}`}
    </div>
  </div>
`

photoList.appendChild(listItem)

const alreadySaved = savedPhotos.some(photo =>
  photo.name === file.name &&
  photo.latitude === gps.latitude &&
  photo.longitude === gps.longitude
)

if (!alreadySaved) {
savedPhotos.push({
  name: file.name,
  latitude: gps.latitude,
  longitude: gps.longitude,
  address: address.displayName,
  landmarkName,
  thumbnailUrl,
  takenAt
})

  localStorage.setItem(
    'visitedPhotos',
    JSON.stringify(savedPhotos)
  )
  updateStats()
  updateAlbums()
}

    } catch (error) {

alert(`${file.name} 사진의 GPS 정보를 읽지 못했어요. 위치 정보가 포함된 원본 사진인지 확인해 주세요.`)

console.log('GPS 없음', file.name)
console.log(error)
    }

  }

})