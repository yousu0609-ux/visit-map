import './style.css'

import { supabase }
  from './supabase'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import exifr from 'exifr'

document.querySelector('#app').innerHTML = `
  <div class="container">
    <h1>전국 방문지 기록</h1>

<div class="auth-box">
  <input id="emailInput" type="email" placeholder="이메일">
  <input id="passwordInput" type="password" placeholder="비밀번호">
  <button id="signupButton">회원가입</button>
  <button id="loginButton">로그인</button>
  <button id="logoutButton">로그아웃</button>
  <p id="authStatus">로그인 안 됨</p>
</div>

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
<div id="tripViewer"></div>

<div id="albumViewer"></div>

<div id="bookViewer"></div>

<div id="lightbox" class="lightbox">
  <img id="lightboxImage">
</div>

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
        const maxSize = 1200

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

        resolve(canvas.toDataURL('image/jpeg', 0.9))
      }

      img.onerror = reject
      img.src = reader.result
    }

    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve(reader.result)
    }

    reader.onerror = () => {
      reject(reader.error)
    }

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
  node(around:1200,${latitude},${longitude})["tourism"="attraction"];
  node(around:1200,${latitude},${longitude})["tourism"="viewpoint"];
  node(around:1200,${latitude},${longitude})["tourism"="museum"];
  node(around:1200,${latitude},${longitude})["tourism"="gallery"];
  node(around:1200,${latitude},${longitude})["historic"];
  node(around:1200,${latitude},${longitude})["leisure"="park"];
  node(around:1200,${latitude},${longitude})["natural"="beach"];
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

  .filter(place => {

    const name = place.tags.name

    const excludeKeywords = [

      '치과',
    '병원',
    '약국',
    '편의점',
    'CU',
    'GS25',
    '세븐일레븐',
    '이마트24',
    '주차장',
    '아파트',
    '오피스텔',
    '주유소',
    '은행',
    '주민센터',
    '파출소',
    '우체국',
    '클리닉',
'골프',
'연습장',
'스크린골프',
'마트',
'슈퍼',
'상가',
'학원',
'교회',
'성당',
'절',
'노래방',
'PC방',
'미용실',
'헤어',
'네일',
'헬스장',
'피트니스',
'게스트하우스',
'호텔',
'모텔',
'펜션',
'숙소',
'리조트',
'민박',
'경찰',
'충혼탑',
'갤러리',
'게스트하우스',
'호텔',
'모텔',
'펜션',
'숙소'

    ]

    return !excludeKeywords.some(
      keyword => name.includes(keyword)
    )

  })
    .map(place => {
      const distance = getDistanceMeters(
        latitude,
        longitude,
        place.lat,
        place.lon
      )

      const tourismType =
  place.tags.tourism ||
  place.tags.historic ||
  place.tags.leisure ||
  ''

return {
  name: place.tags.name,
  distance,
  tourismType
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
    <h3>
  📍 ${album.title}
  <button class="edit-album-button" data-title="${album.title}">
    ✏️
  </button>
</h3>
    <p>${getAlbumDateText(album.photos)}</p>
    <p>사진 ${album.photos.length}장</p>
  </div>
`

albumCard.style.cursor = 'pointer'

albumCard.addEventListener('click', (event) => {
  if (event.target.classList.contains('edit-album-button')) {
    return
  }

  openAlbum(album)
})

const editButton =
  albumCard.querySelector('.edit-album-button')

editButton.addEventListener('click', (event) => {
  event.stopPropagation()

  const newTitle =
    prompt('새 앨범 이름', album.title)

  if (!newTitle) {
    return
  }

  album.photos.forEach(photo => {
    photo.landmarkName = newTitle
  })

  localStorage.setItem(
    'visitedPhotos',
    JSON.stringify(savedPhotos)
  )

  location.reload()
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

    const tripDate =
  photo.displayDate || ''

const key =
  `${tripDate}-${city}`

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

const coverPhoto = photos[0]

const tripTitle =
  generateTripTitle(photos)

      tripCard.innerHTML = `
  <div class="trip-cover">

    ${
      coverPhoto?.thumbnailUrl
        ? `
          <img
            src="${coverPhoto.thumbnailUrl}"
            alt="${key}"
          >
        `
        : ''
    }

  </div>

  <div class="trip-info">

    <h3>${tripTitle}</h3>

    <p>
      장소 ${
        new Set(
          photos.map(
            p => p.landmarkName || p.address
          )
        ).size
      }곳
    </p>

    <p>
      사진 ${photos.length}장
    </p>

  </div>
`

tripCard.style.cursor = 'pointer'

tripCard.addEventListener('click', () => {
  openTrip(photos, key)
})

const bookButton =
  document.createElement('button')

bookButton.textContent =
  '📕 앨범 만들기'

bookButton.addEventListener('click', event => {

  event.stopPropagation()

  openBook(
    tripTitle,
    photos
  )

})

tripCard.appendChild(bookButton)

      tripList.appendChild(tripCard)

    }
  )
}

function generateLandmarkName(name) {

  if (!name) {
    return null
  }

  const excludeKeywords = [

    '치과',
    '병원',
    '약국',
    '편의점',
    'CU',
    'GS25',
    '세븐일레븐',
    '이마트24',
    '주차장',
    '아파트',
    '오피스텔',
    '주유소',
    '은행',
    '주민센터',
    '파출소',
    '우체국',
    '클리닉',
'골프',
'연습장',
'스크린골프',
'마트',
'슈퍼',
'상가',
'학원',
'교회',
'성당',
'절',
'노래방',
'PC방',
'미용실',
'헤어',
'네일',
'헬스장',
'피트니스',
'게스트하우스',
'호텔',
'모텔',
'펜션',
'숙소',
'리조트',
'민박',
'경찰',
'충혼탑',
'갤러리',
'게스트하우스',
'호텔',
'모텔',
'펜션',
'숙소'

  ]

  const isExcluded =
    excludeKeywords.some(
      keyword => name.includes(keyword)
    )

  if (isExcluded) {
    return null
  }

  return name
}

function generateTripTitle(photos) {
  const names = photos
    .map(photo => photo.landmarkName)
    .filter(Boolean)

  const text = names.join(' ')

  if (text.includes('밤바다') || text.includes('여수')) {
    return '🌉 여수 여행'
  }

  if (text.includes('전주') || text.includes('한옥')) {
    return '🍲 전주 여행'
  }

  if (text.includes('경주') || text.includes('첨성대') || text.includes('불국사')) {
    return '🏛️ 경주 역사 여행'
  }

  return `✈️ ${photos[0]?.displayDate || ''} 여행`
}

async function downloadBookPdf(title, photos) {
  const { jsPDF } = window.jspdf
  const pdf = new jsPDF('p', 'mm', 'a4')

  const pageWidth = 210
  const pageHeight = 297

  async function addElementAsPage(element, isFirstPage = false) {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true
    })

    const imageData = canvas.toDataURL('image/png')

    const imageWidth = pageWidth
    const imageHeight =
      canvas.height * imageWidth / canvas.width

    if (!isFirstPage) {
      pdf.addPage()
    }

    pdf.addImage(
      imageData,
      'PNG',
      0,
      0,
      imageWidth,
      imageHeight
    )
  }

const memoButtons =
  document.querySelectorAll('.memo-button')

memoButtons.forEach(button => {
  button.style.display = 'none'
})

const bookPages =
  document.querySelectorAll(
    '.book-cover, .book-overview, .book-place'
  )

let isFirstPage = true

for (const page of bookPages) {
  await addElementAsPage(page, isFirstPage)
  isFirstPage = false
}

memoButtons.forEach(button => {
  button.style.display = ''
})

pdf.save(`${title}.pdf`)

memoButtons.forEach(button => {
  button.style.display = ''
})

} // downloadBookPdf 끝

function openBook(title, photos) {

  const bookViewer =
    document.getElementById('bookViewer')

  const places = {}

photos.forEach(photo => {
  const matchedPlace =
    Object.keys(places).find(name => {
      const firstPhoto = places[name][0]

      return (
        getDistanceMeters(
          firstPhoto.latitude,
          firstPhoto.longitude,
          photo.latitude,
          photo.longitude
        ) < 300
      )
    })

  if (matchedPlace) {
    places[matchedPlace].push(photo)
  } else {
    const placeName =
      generateLandmarkName(photo.landmarkName) ||
      photo.address ||
      '알 수 없는 장소'

    places[placeName] = [photo]
  }
})

  const timelinePhotos =
    [...photos]
      .filter(photo => photo.takenAt)
      .sort(
        (a, b) =>
          new Date(a.takenAt) -
          new Date(b.takenAt)
      )

      const uniqueTimelinePhotos = []

timelinePhotos.forEach(photo => {

  const placeName =
    photo.landmarkName ||
    photo.address

  const lastPhoto =
    uniqueTimelinePhotos[
      uniqueTimelinePhotos.length - 1
    ]

  const lastPlaceName =
    lastPhoto
      ? (
          lastPhoto.landmarkName ||
          lastPhoto.address
        )
      : null

  if (placeName !== lastPlaceName) {
    uniqueTimelinePhotos.push(photo)
  }

})

const startTime =
  new Date(timelinePhotos[0]?.takenAt)

const endTime =
  new Date(
    timelinePhotos[
      timelinePhotos.length - 1
    ]?.takenAt
  )

const diffMinutes =
  Math.floor(
    (endTime - startTime) /
    1000 /
    60
  )

const travelHours =
  Math.floor(diffMinutes / 60)

const travelMinutes =
  diffMinutes % 60

  let totalDistance = 0

for (let i = 1; i < timelinePhotos.length; i++) {

  totalDistance += getDistanceMeters(
    timelinePhotos[i - 1].latitude,
    timelinePhotos[i - 1].longitude,
    timelinePhotos[i].latitude,
    timelinePhotos[i].longitude
  )

}

const totalDistanceKm =
  (totalDistance / 1000).toFixed(1)

  bookViewer.innerHTML = `
    <div class="book">

<div class="book-actions">
  <button id="downloadPdfButton">
    📥 PDF 저장
  </button>
</div>

<div class="book-cover">

  <img
    src="${photos[0]?.fullImageUrl || photos[0]?.thumbnailUrl}"
    class="book-cover-image"
  >

  <h1>${title}</h1>

  <p>
    📅 ${photos[0]?.displayDate || ''}
  </p>

  <p>
    📍 장소 ${
      Object.keys(places).length
    }곳
  </p>

  <p>
    📸 사진 ${photos.length}장
  </p>

<p>
  🕒 여행시간
  ${travelHours}시간
  ${travelMinutes}분
</p>

<p>
  🚗 이동거리
  ${totalDistanceKm}km
</p>

</div>

<div class="book-overview">

  <div class="book-timeline">

  <h2>📅 여행 타임라인</h2>

  ${uniqueTimelinePhotos.map((photo, index) => {
    let badge = '📍 경유'

    if (index === 0) {
      badge = '🟢 출발'
    } else if (index === uniqueTimelinePhotos.length - 1) {
      badge = '🔴 도착'
    }

    return `
      <div class="timeline-item">

        <div class="timeline-badge">
          ${badge}
        </div>

        <div class="timeline-time">
          ${new Date(photo.takenAt)
            .toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit'
            })}
        </div>

        <div class="timeline-place">
          ${
            photo.landmarkName ||
            photo.address
          }
        </div>

      </div>
    `
  }).join('')}

  </div>

  <div class="book-route">

    <h2>🗺️ 여행 경로</h2>

    <div id="routeMap"></div>

  </div>

</div>

<hr>

      ${Object.entries(places).map(
        ([placeName, placePhotos]) => `

          <div class="book-place">

  <h2>📍 ${placeName}</h2>

<button class="memo-button" data-place="${placeName}">
  📝 여행 메모
</button>

<p class="place-memo">
  ${localStorage.getItem(`memo-${placeName}`) || ''}
</p>

<img
  src="${placePhotos[0]?.fullImageUrl || placePhotos[0]?.thumbnailUrl}"
  class="book-place-cover"
>


  <div class="book-photo-grid">

    ${placePhotos.slice(1).map(photo => `
      <img
        src="${photo.fullImageUrl || photo.thumbnailUrl}"
        class="book-photo"
      >
    `).join('')}

  </div>

</div>

        `
      ).join('')}

    </div>
  `

document
  .querySelectorAll('.memo-button')
  .forEach(button => {
    button.addEventListener('click', () => {
      const placeName = button.dataset.place

      const memo = prompt(
        '이 장소의 메모를 입력하세요',
        localStorage.getItem(`memo-${placeName}`) || ''
      )

      if (memo === null) {
        return
      }

      localStorage.setItem(
        `memo-${placeName}`,
        memo
      )

      openBook(title, photos)
    })
  })

const routeMap = L.map('routeMap')

routeMap.setView(
  [
    photos[0].latitude,
    photos[0].longitude
  ],
  10
)

L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
).addTo(routeMap)

const sortedPhotos =
  [...photos]
    .filter(photo => photo.takenAt)
    .sort(
      (a, b) =>
        new Date(a.takenAt) -
        new Date(b.takenAt)
    )

const routePoints = sortedPhotos
  .filter(
    photo =>
      photo.latitude &&
      photo.longitude
  )
  .map(photo => [
    photo.latitude,
    photo.longitude
  ])

  const routePlaces = sortedPhotos
  .filter(
    photo =>
      photo.latitude &&
      photo.longitude
  )
  .map(photo =>
    photo.landmarkName ||
    photo.address ||
    '알 수 없는 장소'
  )

const routeLayer = L.layerGroup().addTo(routeMap)

L.polyline(
  routePoints,
  {
    weight: 5
  }
).addTo(routeLayer)

routePoints.forEach((point, index) => {
  let label = '📍 경유'

  if (index === 0) {
    label = '🟢 출발'
  } else if (index === routePoints.length - 1) {
    label = '🔴 도착'
  }

  L.marker(point)
    .addTo(routeLayer)
    .bindPopup(`
      <strong>${label}</strong><br>
      ${routePlaces[index]}
    `)
})

if (routePoints.length > 1) {
  routeMap.fitBounds(routePoints)
}

setTimeout(() => {
  routeMap.invalidateSize()

  if (routePoints.length > 1) {
    routeMap.fitBounds(routePoints, {
      padding: [30, 30]
    })
  }
}, 500)

document
  .getElementById('downloadPdfButton')
  .addEventListener('click', async () => {
    routeMap.invalidateSize()

    if (routePoints.length > 1) {
      routeMap.fitBounds(routePoints, {
        padding: [30, 30]
      })
    }

    setTimeout(() => {

      routeMap.removeLayer(routeLayer)

      downloadBookPdf(title, photos).then(() => {
  routeLayer.addTo(routeMap)
})
    }, 800)
  })

}   

function openTrip(photos, title) {
  const tripViewer =
    document.getElementById('tripViewer')

  const places = {}

photos.forEach(photo => {

  const matchedPlace =
    Object.keys(places).find(name => {

      const firstPhoto =
        places[name][0]

      return (
        getDistanceMeters(
          firstPhoto.latitude,
          firstPhoto.longitude,
          photo.latitude,
          photo.longitude
        ) < 300
      )

    })

  if (matchedPlace) {

    places[matchedPlace].push(photo)

  } else {

    const placeName =

      generateLandmarkName(
        photo.landmarkName
      )

      ||

      photo.address

      ||

      '알 수 없는 장소'

    places[placeName] = [photo]

  }

})

  const timelinePhotos =
  [...photos]
    .filter(photo => photo.takenAt)
    .sort(
      (a, b) =>
        new Date(a.takenAt) -
        new Date(b.takenAt)
    )

  tripViewer.innerHTML = `
  <div class="trip-summary">

    <h2>${title}</h2>

    <p>
      📍 장소 ${Object.keys(places).length}곳
    </p>

    <p>
      📸 사진 ${photos.length}장
    </p>

    <p>
  🕒 여행 시간
  ${travelHours}시간
  ${travelMinutes}분
</p>

<p>
  🟢 출발

  ${
    timelinePhotos[0]
      ?.landmarkName ||
    timelinePhotos[0]
      ?.address
  }
</p>

<p>
  🔴 도착

  ${
    timelinePhotos[
      timelinePhotos.length - 1
    ]?.landmarkName ||

    timelinePhotos[
      timelinePhotos.length - 1
    ]?.address
  }
</p>

    <p>
      📅 ${photos[0]?.displayDate || ''}
    </p>

  </div>

  ${Object.entries(places).map(([placeName, placePhotos], index) => `
    <div
      class="album-card trip-place-card"
      data-place-index="${index}"
    >

      <h3>📍 ${placeName}</h3>

      <p>
        사진 ${placePhotos.length}장
      </p>

    </div>
  `).join('')}
`
const placeEntries = Object.entries(places)

document.querySelectorAll('.trip-place-card').forEach(card => {
  card.addEventListener('click', () => {
    const index = card.dataset.placeIndex
    const [placeName, placePhotos] = placeEntries[index]

    tripViewer.innerHTML = `
      <h2>📍 ${placeName}</h2>

      <div class="album-photos">
        ${placePhotos.map(photo => `
          <img
  src="${photo.fullImageUrl || photo.thumbnailUrl}"
  class="trip-photo"
  data-photo="${photo.fullImageUrl || photo.thumbnailUrl}"
>
        `).join('')}
      </div>
    `
document
  .querySelectorAll('.trip-photo')
  .forEach(image => {

    image.addEventListener('click', () => {

      openPhoto(
        image.dataset.photo
      )

    })

  })
    
  })
})

}

function openPhoto(photoUrl) {

  const lightbox =
    document.getElementById('lightbox')

  const image =
    document.getElementById('lightboxImage')

  image.src = photoUrl

  lightbox.style.display = 'flex'
}

function openAlbum(album) {

  map.setView([album.centerLatitude, album.centerLongitude], 15)

  const albumViewer =
    document.getElementById('albumViewer')

  albumViewer.innerHTML = `
    <h2>${album.title}</h2>

    <div class="album-photos">
      ${album.photos.map(photo => `
        <img src="${photo.fullImageUrl || photo.thumbnailUrl}">
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

const emailInput = document.getElementById('emailInput')
const passwordInput = document.getElementById('passwordInput')
const signupButton = document.getElementById('signupButton')
const loginButton = document.getElementById('loginButton')
const logoutButton = document.getElementById('logoutButton')
const authStatus = document.getElementById('authStatus')

async function updateAuthStatus() {
  const { data } = await supabase.auth.getUser()

  if (data.user) {
    authStatus.textContent = `로그인됨: ${data.user.email}`
  } else {
    authStatus.textContent = '로그인 안 됨'
  }
}

signupButton.addEventListener('click', async () => {

if (!emailInput.value || !passwordInput.value) {
  alert('이메일과 비밀번호를 입력해 주세요.')
  return
}

  const { error } = await supabase.auth.signUp({
    email: emailInput.value,
    password: passwordInput.value
  })

  if (error) {
    alert(error.message)
  } else {
    alert('회원가입 완료. 이메일 확인이 필요할 수 있어요.')
    updateAuthStatus()
  }
})

loginButton.addEventListener('click', async () => {

if (!emailInput.value || !passwordInput.value) {
  alert('이메일과 비밀번호를 입력해 주세요.')
  return
}

  const { error } = await supabase.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value
  })

  if (error) {
    alert(error.message)
  } else {
    alert('로그인 성공')
    updateAuthStatus()
  }
})

logoutButton.addEventListener('click', async () => {
  await supabase.auth.signOut()
  updateAuthStatus()
})

updateAuthStatus()

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
    ${photo.fullImageUrl || photo.thumbnailUrl ? `<img src="${photo.fullImageUrl || photo.thumbnailUrl}" style="width:160px; border-radius:8px; margin-bottom:8px;">` : ''}
    <strong>${photo.name}</strong><br>
    ${photo.address || `${photo.latitude}, ${photo.longitude}`}
  </div>
`)

  const listItem = document.createElement('li')

listItem.innerHTML = `
  <div class="photo-card">
    ${photo.fullImageUrl || photo.thumbnailUrl ? `<img src="${photo.fullImageUrl || photo.thumbnailUrl}" alt="${photo.name}">` : ''}
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

document
  .getElementById('lightbox')
  .addEventListener('click', () => {

    document
      .getElementById('lightbox')
      .style.display = 'none'

  })

photoInput.addEventListener('change', async (event) => {

  const files = event.target.files

  for (const file of files) {

    try {

      const gps = await exifr.gps(file)
      const exifData = await exifr.parse(file)
const takenAt =
  exifData?.DateTimeOriginal || ''

const displayDate =
  exifData?.DateTimeOriginal
    ? new Date(exifData.DateTimeOriginal)
        .toLocaleDateString('ko-KR')
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
  takenAt,
  displayDate
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

console.log(
  'supabase',
  supabase
)