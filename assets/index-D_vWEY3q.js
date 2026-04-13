(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) return;
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) processPreload(link);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue;
      for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
    }
  }).observe(document, {
    childList: true,
    subtree: true
  });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep) return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const getSearchParamsFromObject = (params) => {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === void 0) continue;
    searchParams.set(key, String(value));
  }
  return searchParams;
};
const parseJSON = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`JSON 파싱 실패: ${text}`);
  }
};
const fetcher = async (endpoint, options = {}) => {
  const defaultOptions = {
    method: "GET",
    ...options,
    headers: {
      accept: "application/json",
      ...options.headers
    }
  };
  const response = await fetch(endpoint, defaultOptions);
  if (response.ok) {
    const data = await parseJSON(response);
    return data;
  }
  const error = await parseJSON(response);
  throw error;
};
class TMDBError extends Error {
  code;
  success;
  constructor({ status_code, status_message, success }) {
    super(status_message);
    this.code = status_code;
    this.success = success;
  }
}
const isTmdbError = (error) => {
  return error instanceof Object && "status_code" in error && "status_message" in error && "success" in error;
};
const tmdbFetcher = async (endpoint, options = {}) => {
  const defaultOptions = {
    method: "GET",
    ...options,
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${"eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzN2YyODFmZjIxNDI2NzFhMzI4MzVmYTZlN2Q3NmJiMyIsIm5iZiI6MTcyNDA1OTU1Mi42MDgsInN1YiI6IjY2YzMwZmEwMThlNjYyMmFkY2QzNjJmNCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.CKZo46_543EbwzSMpmSsAO86ElAORqQapCd5qSHy2Es"}`,
      ...options.headers
    }
  };
  try {
    const response = await fetcher(
      `${"https://api.themoviedb.org/3"}${endpoint}`,
      defaultOptions
    );
    return response;
  } catch (error) {
    if (isTmdbError(error)) {
      throw new TMDBError(error);
    }
    throw error;
  }
};
const getPopularMovies = async (params = {}) => {
  const searchParams = getSearchParamsFromObject(params);
  return await tmdbFetcher(
    `/movie/popular?${searchParams.toString()}`
  );
};
const getMovieDetail = async (movieId) => {
  return await tmdbFetcher(`/movie/${movieId}?language=ko-KR`);
};
const getErrorMessage = (error) => {
  if (error instanceof TMDBError) {
    return "🚨TMDB에서 데이터를 불러오는 중 에러가 발생했습니다🚨";
  }
  return "🚨알 수 없는 에러가 발생했습니다.🚨";
};
const getPageParam = () => {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const prevPage = Number(params.get("page") || 1);
  return prevPage;
};
const incrementPageParam = () => {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const prevPage = getPageParam();
  params.set("page", String(prevPage + 1));
  url.search = params.toString();
  window.history.pushState({}, "", url.toString());
};
const renderBanner = ({ movie }) => {
  const banner = document.getElementById(
    "background-container"
  );
  const bannerTitle = document.querySelector(
    "#background-container h3"
  );
  const bannerRate = document.querySelector(
    "#background-container span"
  );
  if (banner && bannerTitle && bannerRate) {
    banner.style.backgroundImage = `url(${"https://image.tmdb.org/t/p"}/w1280${movie.backdrop_path})`;
    banner.style.backgroundSize = "cover";
    banner.style.backgroundPosition = "center";
    bannerTitle.textContent = movie.title;
    bannerRate.textContent = String(movie.vote_average);
  }
};
const renderThumbnailList = ({
  movies,
  thumbnailListElement
}) => {
  if (thumbnailListElement) {
    const lis = movies.map(
      (movie) => `<li id="movie-${movie.id}">
                    <div class="item">
                      <img
                        class="thumbnail"
                        src="${"https://image.tmdb.org/t/p"}/w500${movie.poster_path}"
                        alt="${movie.title} 포스터"
                      />
                      <div class="item-desc">
                        <p class="rate">
                          <img src="./images/star_empty.png" class="star" /><span
                            >${movie.vote_average}</span
                          >
                        </p>
                        <strong>${movie.title}</strong>
                      </div>
                    </div>
                  </li>`
    );
    thumbnailListElement.insertAdjacentHTML("beforeend", lis.join(""));
  }
};
class MainUI {
  mainState = { type: "loading" };
  mainThumbnailList = document.getElementById("main-thumbnail-list");
  mainSeeMoreButton = document.getElementById("main-see-more-button");
  skeletonList = document.getElementById("skeleton-list");
  emptyContainer = document.getElementById("empty-container");
  errorContainer = document.getElementById("error-container");
  bannerContainer = document.getElementById("background-container");
  errorMessageContent = document.querySelector(
    "#error-container p"
  );
  subTitle = document.getElementById("sub-title");
  thumbnailListElement = document.getElementById(
    "search-thumbnail-list"
  );
  constructor() {
    this.#render();
  }
  setMainState(mainState) {
    this.mainState = mainState;
    this.#render();
  }
  hide() {
    this.mainThumbnailList?.classList.add("hidden");
    this.mainSeeMoreButton?.classList.add("hidden");
    this.skeletonList?.classList.add("hidden");
    this.emptyContainer?.classList.add("hidden");
    this.errorContainer?.classList.add("hidden");
    this.bannerContainer?.classList.add("hidden");
    this.errorMessageContent?.classList.add("hidden");
    this.subTitle?.classList.add("hidden");
  }
  async load() {
    this.setMainState({ type: "loading" });
    try {
      const popularMovies = await getPopularMovies({ language: "ko-KR" });
      const isLastPage = popularMovies.page === popularMovies.total_pages;
      this.setMainState({
        type: "data",
        movies: popularMovies.results,
        isLastPage
      });
    } catch (error) {
      this.setMainState({ type: "error", message: getErrorMessage(error) });
    }
  }
  async seeMore() {
    const popularMovies = await getPopularMovies({ page: getPageParam() + 1 });
    incrementPageParam();
    renderThumbnailList({
      movies: popularMovies.results,
      thumbnailListElement: this.mainThumbnailList
    });
    return !(popularMovies.page === popularMovies.total_pages);
  }
  #render() {
    this.hide();
    if (this.mainState.type === "data") {
      this.mainThumbnailList?.classList.remove("hidden");
      renderThumbnailList({
        movies: this.mainState.movies,
        thumbnailListElement: this.mainThumbnailList
      });
      const bannerMovieInfo = this.mainState.movies[0];
      if (bannerMovieInfo) {
        this.bannerContainer?.classList.remove("hidden");
        renderBanner({ movie: bannerMovieInfo });
      }
      if (!this.mainState.isLastPage)
        this.mainSeeMoreButton?.classList.remove("hidden");
      else {
        this.mainSeeMoreButton?.classList.add("hidden");
      }
    }
    if (this.mainState.type === "empty") {
      this.emptyContainer?.classList.remove("hidden");
    }
    if (this.mainState.type === "error") {
      this.errorContainer?.classList.remove("hidden");
      this.errorMessageContent.innerText = this.mainState.message;
    }
    if (this.mainState.type === "loading") {
      this.skeletonList?.classList.remove("hidden");
    }
  }
}
const STAR_EMPTY = "./images/star_empty.png";
const STAR_FILLED = "./images/star_filled.png";
const RATE_LABELS = [
  "",
  "최악이에요",
  "별로예요",
  "보통이에요",
  "재미있어요",
  "명작이에요"
];
class ModalUI {
  modalState = { type: "loading" };
  modalBackground = document.getElementById("modalBackground");
  modalCloseButton = document.getElementById("closeModal");
  modalImageContainer = document.getElementById("modal-image");
  modalImage = document.querySelector("#modal-image img");
  modalTitle = document.getElementById("modal-title");
  modalCategory = document.getElementById("modal-category");
  modalRate = document.getElementById("modal-rate");
  modalDetail = document.getElementById("modal-detail");
  modalRateReview = document.getElementById("modal-rate-review");
  modalRatePoints = document.getElementById("modal-rate-points");
  starEls = [1, 2, 3, 4, 5].map(
    (i) => document.getElementById(
      `modal-my-rate-star-${i}`
    )
  );
  currentMovieId = null;
  myRating = 0;
  ratingRepository;
  constructor(ratingRepository2) {
    this.ratingRepository = ratingRepository2;
    this.hide();
    this.#initStarEvents();
    this.modalCloseButton?.addEventListener("click", () => {
      this.hide();
    });
    this.modalBackground?.addEventListener("click", (e) => {
      if (e.target === this.modalBackground) this.hide();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.modalBackground?.classList.contains("hidden"))
        this.hide();
    });
  }
  #initStarEvents() {
    this.starEls.forEach((star, index) => {
      star?.addEventListener("click", () => {
        if (this.currentMovieId === null) return;
        this.myRating = index + 1;
        this.ratingRepository.setRate(this.currentMovieId, this.myRating);
        this.#updateStars();
      });
    });
  }
  #updateStars() {
    this.starEls.forEach((star, index) => {
      if (!star) return;
      star.src = index < this.myRating ? STAR_FILLED : STAR_EMPTY;
    });
    if (this.modalRateReview)
      this.modalRateReview.innerText = RATE_LABELS[this.myRating];
    if (this.modalRatePoints)
      this.modalRatePoints.innerText = this.myRating ? `(${this.myRating * 2}/10)` : "";
  }
  #setModalState(modalState) {
    this.modalState = modalState;
    this.#render();
  }
  #addSkeletonClasses() {
    this.modalImageContainer?.classList.add("modal-skeleton-image");
    this.modalTitle?.classList.add("modal-skeleton", "modal-skeleton-title");
    this.modalCategory?.classList.add(
      "modal-skeleton",
      "modal-skeleton-category"
    );
    this.modalRate?.classList.add("modal-skeleton", "modal-skeleton-rate");
    this.modalDetail?.classList.add("modal-skeleton", "modal-skeleton-detail");
    if (this.modalImage) this.modalImage.src = "";
    if (this.modalTitle) this.modalTitle.innerText = "";
    if (this.modalCategory) this.modalCategory.innerText = "";
    if (this.modalRate) this.modalRate.innerText = "";
    if (this.modalDetail) this.modalDetail.innerText = "";
  }
  #removeSkeletonClasses() {
    this.modalImageContainer?.classList.remove("modal-skeleton-image");
    this.modalTitle?.classList.remove("modal-skeleton", "modal-skeleton-title");
    this.modalCategory?.classList.remove(
      "modal-skeleton",
      "modal-skeleton-category"
    );
    this.modalRate?.classList.remove("modal-skeleton", "modal-skeleton-rate");
    this.modalDetail?.classList.remove(
      "modal-skeleton",
      "modal-skeleton-detail"
    );
  }
  hide() {
    this.modalBackground?.classList.add("hidden");
  }
  async load(movieId) {
    this.currentMovieId = movieId;
    this.myRating = this.ratingRepository.getRate(movieId) ?? 0;
    this.#updateStars();
    this.#setModalState({ type: "loading" });
    this.modalBackground?.classList.remove("hidden");
    try {
      const movie = await getMovieDetail(movieId);
      this.#setModalState({ type: "data", movie });
    } catch (error) {
      this.#setModalState({ type: "error", message: getErrorMessage(error) });
    }
  }
  #render() {
    if (this.modalState.type === "loading") {
      this.#addSkeletonClasses();
      return;
    }
    if (this.modalState.type === "error") {
      this.#removeSkeletonClasses();
      if (this.modalDetail)
        this.modalDetail.innerText = this.modalState.message;
      return;
    }
    if (this.modalState.type === "data") {
      this.#removeSkeletonClasses();
      const { movie } = this.modalState;
      const year = movie.release_date.slice(0, 4);
      const genres = movie.genres.map((g) => g.name).join(", ");
      if (this.modalImage)
        this.modalImage.src = `${"https://image.tmdb.org/t/p"}/w500${movie.poster_path}`;
      if (this.modalTitle) this.modalTitle.innerText = movie.title;
      if (this.modalCategory)
        this.modalCategory.innerText = `${year} · ${genres}`;
      if (this.modalRate)
        this.modalRate.innerText = String(movie.vote_average.toFixed(1));
      if (this.modalDetail) this.modalDetail.innerText = movie.overview;
    }
  }
}
const getSearchedMovies = async (params = {}) => {
  const searchParams = getSearchParamsFromObject(params);
  return await tmdbFetcher(
    `/search/movie?${searchParams.toString()}`
  );
};
const getKeywordFromURL = () => {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const keyword = params.get("keyword");
  return keyword;
};
class SearchUI {
  searchState = { type: "loading" };
  searchThumbnailList = document.getElementById("search-thumbnail-list");
  searchSeeMoreButton = document.getElementById("search-see-more-button");
  skeletonList = document.getElementById("skeleton-list");
  errorContainer = document.getElementById("error-container");
  emptyContainer = document.getElementById("empty-container");
  resultSection = document.getElementById("result-section");
  subTitle = document.getElementById("sub-title");
  errorMessageContent = document.querySelector(
    "#error-container p"
  );
  thumbnailListElement = document.getElementById(
    "search-thumbnail-list"
  );
  keyword = getKeywordFromURL();
  constructor() {
    this.#render();
  }
  setSearchState(searchState) {
    this.searchState = searchState;
    this.#render();
  }
  hide() {
    this.searchThumbnailList?.classList.add("hidden");
    this.searchSeeMoreButton?.classList.add("hidden");
    this.skeletonList?.classList.add("hidden");
    this.errorContainer?.classList.add("hidden");
    this.emptyContainer?.classList.add("hidden");
    this.errorMessageContent?.classList.add("hidden");
    this.subTitle?.classList.add("hidden");
  }
  async load() {
    this.setSearchState({ type: "loading" });
    this.thumbnailListElement.innerHTML = "";
    try {
      const keyword = getKeywordFromURL();
      const searchResult = await getSearchedMovies({
        query: keyword || "",
        language: "ko-KR",
        page: 1
      });
      this.setSearchState({
        type: "data",
        movies: searchResult.results,
        isLastPage: searchResult.page === searchResult.total_pages
      });
    } catch (error) {
      this.setSearchState({ type: "error", message: getErrorMessage(error) });
    }
  }
  async seeMore() {
    const searchedMovies = await getSearchedMovies({
      query: this.keyword || "",
      page: getPageParam() + 1,
      language: "ko-KR"
    });
    incrementPageParam();
    renderThumbnailList({
      movies: searchedMovies.results,
      thumbnailListElement: this.searchThumbnailList
    });
    return !(searchedMovies.page === searchedMovies.total_pages);
  }
  #render() {
    this.hide();
    this.resultSection?.classList.add("result-section");
    const keyword = getKeywordFromURL();
    if (!this.subTitle) return;
    this.subTitle?.classList.remove("hidden");
    this.subTitle.innerText = `"${keyword}" 검색 결과`;
    if (this.searchState.type === "data") {
      this.searchThumbnailList?.classList.remove("hidden");
      renderThumbnailList({
        movies: this.searchState.movies,
        thumbnailListElement: this.searchThumbnailList
      });
      if (!this.searchState.isLastPage)
        this.searchSeeMoreButton?.classList.remove("hidden");
      else {
        this.searchSeeMoreButton?.classList.add("hidden");
      }
    }
    if (this.searchState.type === "empty") {
      this.emptyContainer?.classList.remove("hidden");
    }
    if (this.searchState.type === "error") {
      this.errorContainer?.classList.remove("hidden");
      this.errorMessageContent.innerText = this.searchState.message;
    }
    if (this.searchState.type === "loading") {
      this.skeletonList?.classList.remove("hidden");
    }
  }
}
class RatingRepository {
  getRate(movieId) {
    const value = localStorage.getItem(`movie-${movieId}`);
    return value ? Number(value) : null;
  }
  setRate(movieId, rate) {
    localStorage.setItem(`movie-${movieId}`, rate.toString());
  }
}
const setURLParams = (params) => {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  window.history.pushState({}, "", url.toString());
};
const mainUI = new MainUI();
const searchUI = new SearchUI();
const ratingRepository = new RatingRepository();
const modalUI = new ModalUI(ratingRepository);
document.addEventListener("click", (e) => {
  const item = e.target.closest("li[id^='movie-']");
  if (!item) return;
  const movieId = Number(item.id.replace("movie-", ""));
  modalUI.load(movieId);
});
const logo = document.getElementById("logo");
const searchInput = document.getElementById(
  "search-input"
);
const searchButton = document.getElementById("search-button");
const mainSeeMoreButton = document.getElementById("main-see-more-button");
const searchSeeMoreButton = document.getElementById("search-see-more-button");
const sentinel = document.getElementById("sentinel");
if (logo) {
  logo.addEventListener("click", () => {
    window.location.href = "/javascript-movie-review/";
  });
}
const handleSearch = () => {
  if (searchInput?.value.trim() === "") {
    window.history.pushState({}, "", "/javascript-movie-review/");
    searchUI.hide();
    mainUI.load();
    return;
  }
  setURLParams({ keyword: searchInput.value, page: "1" });
  mainUI.hide();
  searchUI.load();
};
if (searchInput && searchButton) {
  searchButton.addEventListener("click", handleSearch);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
  });
}
if (mainSeeMoreButton) {
  mainSeeMoreButton.addEventListener("click", () => {
    mainUI.seeMore();
  });
}
if (searchSeeMoreButton && searchInput) {
  searchSeeMoreButton.addEventListener("click", () => {
    searchUI.seeMore();
  });
}
const render = async () => {
  const keyword = getKeywordFromURL();
  if (keyword) {
    await searchUI.load();
  } else {
    await mainUI.load();
  }
};
await render();
if (sentinel) {
  let isLoading = false;
  const observer = new IntersectionObserver(
    async (entries, observer2) => {
      if (!entries[0].isIntersecting || isLoading) return;
      isLoading = true;
      try {
        const keyword = getKeywordFromURL();
        const hasMore = keyword ? await searchUI.seeMore() : await mainUI.seeMore();
        if (!hasMore) observer2.disconnect();
      } finally {
        isLoading = false;
      }
    },
    { rootMargin: "200px" }
  );
  observer.observe(sentinel);
}
