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
const fetcher = async (endpoint, options = {}) => {
  const defaultOptions = {
    method: "GET",
    ...options,
    headers: {
      accept: "application/json",
      ...options.headers
    }
  };
  try {
    const response = await fetch(endpoint, defaultOptions);
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    const error = await response.json();
    throw error;
  } catch (error) {
    throw error;
  }
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
const getSearchedMovies = async (params = {}) => {
  const searchParams = getSearchParamsFromObject(params);
  return await tmdbFetcher(
    `/search/movie?${searchParams.toString()}`
  );
};
const renderResultSectionContent = ({
  isLoading,
  isError,
  errorMessage,
  isLastPage = true,
  movies
}) => {
  const skeletonList = document.getElementById("skeleton-list");
  const errorContainer = document.getElementById("error-container");
  const emptyContainer = document.getElementById("empty-container");
  const errorMessageContent = document.querySelector(
    "#error-container p"
  );
  const mainThumbnailList = document.getElementById("main-thumbnail-list");
  const mainSeeMoreButton2 = document.getElementById("main-see-more-button");
  const searchThumbnailList = document.getElementById("search-thumbnail-list");
  const searchSeeMoreButton2 = document.getElementById("search-see-more-button");
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const keyword = params.get("keyword");
  const type = keyword ? "search" : "main";
  skeletonList?.classList.add("hidden");
  errorContainer?.classList.add("hidden");
  mainThumbnailList?.classList.add("hidden");
  searchThumbnailList?.classList.add("hidden");
  emptyContainer?.classList.add("hidden");
  mainSeeMoreButton2?.classList.add("hidden");
  if (isLoading) {
    skeletonList?.classList.remove("hidden");
    return;
  }
  if (isError && errorMessage) {
    errorContainer?.classList.remove("hidden");
    errorMessageContent.innerText = errorMessage;
    return;
  }
  if (movies.length > 0 && type === "main") {
    mainThumbnailList?.classList.remove("hidden");
    if (!isLastPage) mainSeeMoreButton2?.classList.remove("hidden");
    return;
  }
  if (movies.length > 0 && type === "search") {
    searchThumbnailList?.classList.remove("hidden");
    if (!isLastPage) searchSeeMoreButton2?.classList.remove("hidden");
    return;
  }
  emptyContainer?.classList.remove("hidden");
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
const renderSearchUI = async (keyword) => {
  const searchInput2 = document.getElementById(
    "search-input"
  );
  const banner = document.getElementById("background-container");
  const resultSection = document.getElementById("result-section");
  const subTitle = document.getElementById("sub-title");
  const thumbnailListElement = document.getElementById("search-thumbnail-list");
  searchInput2.value = keyword;
  let isError = false;
  let isLastPage = true;
  let movies = [];
  let errorMessage = "";
  if (!banner || !subTitle || searchInput2?.value.trim() === "") return;
  try {
    const searchResult = await getSearchedMovies({
      query: keyword,
      language: "ko-KR",
      page: 1
    });
    banner.hidden = true;
    resultSection?.classList.add("result-section");
    subTitle.innerText = `"${keyword}" 검색 결과`;
    isLastPage = searchResult.page === searchResult.total_pages;
    movies = searchResult.results;
    renderThumbnailList({ movies, thumbnailListElement });
  } catch (error) {
    isError = true;
    errorMessage = "🚨알 수 없는 에러가 발생했습니다.🚨";
    if (error instanceof TMDBError) {
      errorMessage = "🚨TMDB에서 데이터를 불러오는 중 에러가 발생했습니다🚨";
    }
  } finally {
    renderResultSectionContent({
      isLoading: false,
      isError,
      errorMessage,
      movies,
      isLastPage
    });
  }
};
const handleMovieSearch = async (keyword) => {
  if (keyword.trim() === "") {
    const hasKeyword = new URLSearchParams(window.location.search).has(
      "keyword"
    );
    if (hasKeyword) {
      window.location.href = "/javascript-movie-review/";
    }
    return;
  }
  const searchInput2 = document.getElementById(
    "search-input"
  );
  const banner = document.getElementById("background-container");
  const subTitle = document.getElementById("sub-title");
  const thumbnailListElement = document.getElementById(
    "search-thumbnail-list"
  );
  if (!banner || !subTitle || searchInput2?.value.trim() === "") return;
  const url = new URL(window.location.href);
  const params = url.searchParams;
  params.set("keyword", keyword);
  params.set("page", String(1));
  url.search = params.toString();
  window.history.pushState({}, "", url.toString());
  thumbnailListElement.innerHTML = "";
  await renderSearchUI(keyword);
};
const getPopularMovies = async (params = {}) => {
  const searchParams = getSearchParamsFromObject(params);
  return await tmdbFetcher(
    `/movie/popular?${searchParams.toString()}`
  );
};
const handleMainSeeMore = async () => {
  const mainThumbnailList = document.getElementById("main-thumbnail-list");
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const prevPage = Number(params.get("page") || 1);
  params.set("page", String(prevPage + 1));
  url.search = params.toString();
  window.history.pushState({}, "", url.toString());
  const movies = await getPopularMovies({
    page: prevPage + 1,
    language: "ko-KR"
  });
  renderThumbnailList({
    movies: movies.results,
    thumbnailListElement: mainThumbnailList
  });
};
const handleSearchSeeMore = async (keyword) => {
  const mainThumbnailList = document.getElementById("search-thumbnail-list");
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const prevPage = Number(params.get("page") || 1);
  params.set("page", String(prevPage + 1));
  url.search = params.toString();
  window.history.pushState({}, "", url.toString());
  const movies = await getSearchedMovies({
    query: keyword,
    page: prevPage + 1,
    language: "ko-KR"
  });
  renderThumbnailList({
    movies: movies.results,
    thumbnailListElement: mainThumbnailList
  });
};
const renderInitialUI = () => {
  renderResultSectionContent({
    isLoading: true,
    isError: false,
    isLastPage: true,
    movies: []
  });
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
const renderMainUI = async () => {
  let isError = false;
  let isLastPage = true;
  let movies = [];
  let errorMessage = "";
  try {
    const thumbnailListElement = document.getElementById("main-thumbnail-list");
    const popularMovies = await getPopularMovies({ language: "ko-KR" });
    isLastPage = popularMovies.page === popularMovies.total_pages;
    movies = popularMovies.results;
    renderBanner({ movie: movies[0] });
    renderThumbnailList({ movies, thumbnailListElement });
  } catch (error) {
    isError = true;
    errorMessage = "🚨알 수 없는 에러가 발생했습니다.🚨";
    if (error instanceof TMDBError) {
      errorMessage = "🚨TMDB에서 데이터를 불러오는 중 에러가 발생했습니다🚨";
    }
  } finally {
    renderResultSectionContent({
      isLoading: false,
      isError,
      isLastPage,
      errorMessage,
      movies
    });
  }
};
const logo = document.getElementById("logo");
const searchInput = document.getElementById(
  "search-input"
);
const searchButton = document.getElementById("search-button");
const mainSeeMoreButton = document.getElementById("main-see-more-button");
const searchSeeMoreButton = document.getElementById("search-see-more-button");
if (logo) {
  logo.addEventListener("click", () => {
    window.location.href = "/javascript-movie-review/";
  });
}
if (searchInput && searchButton) {
  searchButton.addEventListener(
    "click",
    () => handleMovieSearch(searchInput.value)
  );
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleMovieSearch(searchInput.value);
  });
}
if (mainSeeMoreButton) {
  mainSeeMoreButton.addEventListener("click", () => {
    handleMainSeeMore();
  });
}
if (searchSeeMoreButton && searchInput) {
  searchSeeMoreButton.addEventListener("click", () => {
    handleSearchSeeMore(searchInput.value);
  });
}
const render = async () => {
  renderInitialUI();
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const keyword = params.get("keyword");
  if (keyword) {
    await renderSearchUI(keyword);
  } else {
    await renderMainUI();
  }
};
await render();
