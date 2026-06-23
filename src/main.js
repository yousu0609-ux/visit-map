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
</div>

<h2>방문 지역</h2>
<ul id="regionList"></ul>

    <div id="map"></div>

    <h2>등록된 사진</h2>
    <ul id="photoList"></ul>
  </div>
`

const map = L.map('map').setView([36.5, 127.8], 7)

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

function updateStats() {
  const photoCount = document.getElementById('photoCount')
  const regionCount = document.getElementById('regionCount')
  const regionList = document.getElementById('regionList')

  photoCount.textContent = savedPhotos.length

  const regions = [...new Set(
    savedPhotos
      .map(photo => photo.address)
      .filter(Boolean)
  )]

  regionCount.textContent = regions.length

  regionList.innerHTML = ''

  regions.forEach(region => {
    const listItem = document.createElement('li')
    listItem.textContent = region
    regionList.appendChild(listItem)
  })
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
  ])
  .addTo(map)
  .bindPopup(photo.name)

  const listItem = document.createElement('li')

listItem.innerHTML = `
  ${photo.name} / ${photo.address || `${photo.latitude}, ${photo.longitude}`}
  <button data-index="${index}">삭제</button>
`

listItem.querySelector('button').addEventListener('click', () => {
  deletePhoto(index)
})

photoList.appendChild(listItem)

})

updateStats()

photoInput.addEventListener('change', async (event) => {

  const files = event.target.files

  for (const file of files) {

    try {

      const gps = await exifr.gps(file)

      console.log(file.name)
      console.log(gps)

const address = await getAddress(gps.latitude, gps.longitude)
console.log(address)

const imageUrl = URL.createObjectURL(file)

L.marker([
  gps.latitude,
  gps.longitude
])
.addTo(map)
.bindPopup(`
  <div>
    <strong>${file.name}</strong><br>
    <img src="${imageUrl}" style="width:160px; margin-top:8px; border-radius:8px;">
  </div>
`)

map.setView([gps.latitude, gps.longitude], 13)

const listItem = document.createElement('li')
listItem.textContent =
  `${file.name} / ${address.displayName || `${gps.latitude}, ${gps.longitude}`}`
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
  address: address.displayName
})

  localStorage.setItem(
    'visitedPhotos',
    JSON.stringify(savedPhotos)
  )
  updateStats()
}

    } catch (error) {

      console.log('GPS 없음', file.name)

    }

  }

})