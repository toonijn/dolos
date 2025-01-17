<template>
  <v-container fluid>
    <div class="hero">
      <h2 class="hero-title">
        DOLOS
      </h2>
      <div class="hero-subtitle text--secondary">
        Source code plagiarism detection
      </div>
    </div>

    <v-row>
      <v-col cols="12" md="6" lg="3" class="info-cards">
        <v-card class="info-card">
          <v-card-title class="pb-0">Submissions</v-card-title>

          <v-list class="info-list" dense>
            <v-list-item class="info-list-item">
              <v-icon>mdi-file-outline</v-icon>
              <span>{{ filesCount }} submissions</span>
            </v-list-item>

            <v-list-item class="info-list-item">
              <v-icon>mdi-xml</v-icon>
              <span>{{ language }}</span>
            </v-list-item>
          </v-list>

          <template>
            <v-card-title class="info-card-subtitle pt-0 pb-0">
              {{ hasLabels ? legendCount : "No" }} labels detected
            </v-card-title>

            <labels-table class="info-card-labels" show-submissions />
          </template>
        </v-card>
      </v-col>

      <v-col cols="12" md="6" lg="3" class="stat-cards">
        <v-card class="stat-card">
          <div class="stat-card-icon">
            <div class="stat-card-icon-background primary"></div>
            <v-icon color="primary" x-large>mdi-chart-bell-curve</v-icon>
          </div>

          <div class="stat-card-content">
            <h3 class="stat-card-title">
              Highest similarity

              <info-dot>
                The highest similarity we've found between two submissions is
                {{ (highestSimilarity * 100).toFixed(0) }}%
              </info-dot>
            </h3>
            <div class="stat-card-value">
              <similarity-display :similarity="highestSimilarity" text />
            </div>
            <router-link
              class="stat-card-subtitle text--secondary"
              to="/submissions"
            >
              View submissions
            </router-link>
          </div>
        </v-card>

        <v-card class="stat-card">
          <div class="stat-card-icon">
            <div class="stat-card-icon-background primary"></div>
            <v-icon color="primary" size="64">mdi-approximately-equal</v-icon>
          </div>

          <div class="stat-card-content">
            <h3 class="stat-card-title">
              Average similarity

              <info-dot>
                Average of the highest similarity for each submission.
              </info-dot>
            </h3>
            <div class="stat-card-value">
              <similarity-display :similarity="averageSimilarity" text />
            </div>
            <div class="stat-card-subtitle text--secondary">
              Median similarity: {{ (medianSimilarity * 100).toFixed(0) }}%
            </div>
          </div>
        </v-card>

        <v-card class="stat-card">
          <div class="stat-card-icon">
            <div class="stat-card-icon-background primary"></div>
            <v-icon color="primary" x-large>mdi-account-group-outline</v-icon>
          </div>

          <div class="stat-card-content">
            <h3 class="stat-card-title">
              Clusters

              <info-dot>
                Submissions are grouped into clusters based on their similarity.
                If a submission pair has a similarity above the threshold, they will belong to the same cluster.
              </info-dot>
            </h3>
            <div class="stat-card-value">{{ clustering.length }}</div>
            <div class="stat-card-subtitle text--secondary">
              Based on the current threshold ({{ (apiStore.cutoff * 100).toFixed(0) }}%)
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Similarity distribution -->
      <v-col cols="12" lg="6">
        <v-card class="graph-card">
          <v-row justify="space-between" align="center" no-wrap no-gutters>
            <v-col cols="auto">
              <v-card-title>
                Similarity distribution &nbsp;

                <info-dot>
                  This plot shows the distribution of the similarity for the
                  analysed submissions. This distribution looks different for
                  every dataset, and shows you which degrees of similarity may
                  be interesting to look at. You can also use it to tweak the
                  interpolated cluster cutoff value.
                </info-dot>
              </v-card-title>
            </v-col>

            <v-col cols="auto">
              <similarity-setting class="px-4 pt-4" />
            </v-col>
          </v-row>

          <overview-barchart
            :ticks="20"
            :extra-line="apiStore.cutoff"
          />
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Submissions</v-card-title>
          <v-card-subtitle>Highlights the most suspicious individual submissions, useful for exams.</v-card-subtitle>

          <submissions-table :files="submissionsOverview" concise disable-sorting />

          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" text block to="/submissions">
              <span v-if="filesCount > 1">View all {{ filesCount }} submissions</span>
              <span v-else>View all submissions</span>
              <v-icon right>mdi-chevron-right</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Clusters</v-card-title>
          <v-card-subtitle>Aggregates submissions in groups, useful for exercises.</v-card-subtitle>

          <clusters-table :clusters="clustersOverview" concise disable-sorting />

          <v-card-actions>
            <v-spacer />
            <v-btn color="primary" text block to="/clusters">
              <span v-if="clustersCount > 1">View all {{ clustersCount }} clusters</span>
              <span v-else>View all clusters</span>
              <v-icon right>mdi-chevron-right</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { Pair } from "@/api/models";
import {
  useApiStore,
  useFileStore,
  usePairStore,
  useMetadataStore,
} from "@/api/stores";

const apiStore = useApiStore();
const fileStore = useFileStore();
const pairStore = usePairStore();
const metadataStore = useMetadataStore();
const { legend, similaritiesList, hasLabels } = storeToRefs(fileStore);
const { clustering, sortedClustering } = storeToRefs(pairStore);

// File legend.
const legendCount = computed(() => Object.keys(legend.value ?? {}).length);

// Amount of files.
const filesCount = computed(() => fileStore.filesActiveList.length);

// Highest similarity pair.
const highestSimilarityPair = computed<Pair | null>(() => {
  const pairs = Object.values(pairStore.pairsActive);
  return pairs.reduce(
    (a: Pair | null, b: Pair) =>
      (a?.similarity ?? 0) > b.similarity ? a : b,
    null
  );
});

// Highest similarity.
const highestSimilarity = computed(() => {
  const pair = highestSimilarityPair.value;
  return pair?.similarity ?? 0;
});

// Similarities map for every file
// Contains the max similarity for each file.
const similarities = computed(() =>
  similaritiesList.value.map(f => f?.similarity || 0)
);

// Average maximum similarity.
const averageSimilarity = computed(() => {
  const mean = similarities.value.reduce((a, b) => a + b, 0) / similarities.value.length ?? 0;
  return isNaN(mean) ? 0 : mean;
});

// Median maximum similarity.
const medianSimilarity = computed(() => {
  const sorted = [...similarities.value].sort();
  const middle = Math.floor(sorted.length / 2);
  const median = sorted[middle];
  return isNaN(median) ? 0 : median;
});

// Programming language, capitalized.
const language = computed(() => {
  const lang = metadataStore.metadata.language;
  return lang.charAt(0).toUpperCase() + lang.slice(1);
});

// First x amount of submissions to display.
// Sorted by highest similarity
const submissionsOverview = computed(() => {
  const submissions = fileStore.filesActiveList;
  return submissions.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
});

// First x amount of clusters to display.
const clustersOverview = computed(() => {
  return sortedClustering.value.slice(0, 10);
});

// Total amount of clusters
const clustersCount = computed(() => sortedClustering.value.length);
</script>

<style lang="scss" scoped>
.hero {
  padding-bottom: 1rem;

  &-title {
    font-size: 2.5rem;
  }

  &-subtitle {
    font-size: 1.25rem;
  }
}

.stat-cards {
  display: flex;
  flex-direction: column;
  justify-content: stretch;
  gap: 1rem;
}

.stat-card {
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-grow: 1;

  &-icon {
    height: 110px;
    width: 110px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px !important;
    position: relative;
    overflow: hidden;
    z-index: 1;

    &:before {
      content: " ";
      position: absolute;
      z-index: 1;
      width: 100%;
      height: 100%;
      inset: 0;
      z-index: -1;
      background-color: var(--v-primary-base);
      opacity: 0.15;
    }
  }

  &-title {
    font-size: 1.25rem;
    font-weight: 500;
  }

  &-value {
    font-size: 2.25rem;
    font-weight: 700;
  }
}

.info-cards {
  display: flex;
  flex-direction: column;
  justify-content: stretch;
  gap: 1rem;
}

.info-card {
  display: flex;
  flex-direction: column;
  flex-grow: 1;

  &-subtitle {
    font-size: 1rem;
    font-weight: 500;
  }

  &-actions {
    flex: 1;
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
  }

  &-labels {
    max-height: 300px;
    margin-top: 0.5rem;
  }
}

.info-list {
  &-item {
    display: flex;
    gap: 0.5rem;
    width: 100%;
  }
}

.graph-card {
  height: 100%;
}

.label-text {
  text-align: right;
  padding: 5px 15px;
  width: 100%;
  display: block;
}
</style>
