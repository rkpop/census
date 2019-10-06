import React from 'react';
import './App.css';
import results from './censusData.json';
import sortBy from 'lodash-es/sortBy';
import Chart from 'chart.js';
import groupBy from 'lodash-es/groupBy';
import cacheContents from './cache.json';

const BarGraph: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  React.useEffect(() => {
    const ctx = ref.current!.getContext('2d')!
    const myChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(thing => thing.label),
        datasets: [{
          label: '# of Votes',
          data: data.map(thing => thing.value),
          backgroundColor: data.map(thing => thing.color),
          borderColor: data.map(() => 'black'),
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true
            }
          }]
        }
      }
    });
    return (() => { myChart.destroy() })
  })
  return <canvas width='400' height='400' ref={ref}></canvas>
}

const StackedBarGraph: React.FC<{
  data: { value: number; label: string; stack: string; color: string; stackOrder: number; }[];
}> = ({ data }) => {
  console.log(data);
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  React.useEffect(() => {
    const ctx = ref.current!.getContext('2d')!
    const stacks = [... new Set(data.map(item => item.stack))];
    const myChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: stacks,
        datasets: [...data].sort((item1, item2) => item1.stackOrder - item2.stackOrder).map(item => {
          return { label: item.label, data: stacks.map(stack => stack === item.stack ? item.value : null), backgroundColor: item.color }
        })
      },
      options: {
        legend: {
          display: false,
        },
        scales: {
          xAxes: [{
            stacked: true
          }],
          yAxes: [{
            stacked: true
          }]
        }
      }
    });
    return (() => { myChart.destroy() })
  })
  return <canvas width='400' height='400' ref={ref}></canvas>
}

const App: React.FC = () => {
  const usernames = new Set<string>();
  const cleanedResults: any[] = [];
  for (const result of results as any[]) {
    const name = result["Reddit User Name (This will not be shared)"];
    if (name === "") {
      continue;
    }
    if (!usernames.has(name)) {
      usernames.add(name);
      cleanedResults.push(result);
    }
  }

  const allGroups = new Set<string>();
  cleanedResults.forEach(result => {
    const groupsLiked = (result["What is your favorite group?"] as string).split(";").filter(group => !!group);
    groupsLiked.forEach(group => { allGroups.add(group) });
  });
  const groupCounts = new Map<string, number>();
  const groupCountsTogether = new Map<string, number>();
  cleanedResults.forEach(result => {
    const groupsLiked = (result["What is your favorite group?"] as string).split(";").filter(group => !!group);
    groupsLiked.forEach(group => {
      groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
    });
    groupsLiked.forEach(group => {
      groupsLiked.forEach(group2 => {
        const key = `${group} -- ${group2}`
        groupCountsTogether.set(key, (groupCountsTogether.get(key) || 0) + 1);
      });
    })
  });


  function readableCount<T>(m: Map<T, number>): React.ReactNode {
    return sortBy([...m.entries()], ([, count]) => count).reverse().map(([key, count], index) => <li key={index}>{key} has {count}</li>)
  }

  function countThings<T>(f: (counted: any) => T): Map<T, number> {
    const m = new Map<T, number>()
    for (const cleanResult of cleanedResults) {
      const key = f(cleanResult);
      if (key as any === "") {
        continue;
      }
      if (!m.has(key)) {
        m.set(key, 0);
      }
      m.set(key, m.get(key)! + 1);
    }
    return m;
  }
  const totalCount = myCachingFunction(`userCount`, () => usernames.size);
  return (
    <div className="App">
      <header className="App-header">
      </header>
      <section className="section">
        <div className="container">
          <article className="message is-primary">
            <div className="message-header"><p>Some Quick Highlights</p></div>
            <div className="message-body">
              <ul>
                <li>
                  We had {totalCount} responses this year!
                  That's {totalCount - 4286} more than last year and beats our old record of 6465 by {totalCount - 6465}!
                </li>
              </ul>
            </div>
          </article>
        </div>
      </section>
      {myCachingFunction(`keysOnEachResponse`, () => Object.keys(cleanedResults[0])).map(key => {
        if (["Timestamp", "Reddit User Name (This will not be shared)", "field31"].includes(key)) {
          return null;
        }
        const sortOnKeys = ["Age", "Education", "What time zone are you in?", "When did you start listening to K-pop?"]
        const barGraphs = ["What Race or Ethnicity do you identify as?", "Employment Status", "Age", "Gender Identity Part 1", "Gender Identity Part 2", "Sexuality", "Relationship Status", "Field of Employment/Study", "What time zone are you in?", "How were you first exposed to K-pop?", "When did you start listening to K-pop?", "Do you know Korean?", "Are you learning, or do you want to learn Korean?", "How do you listen to K-pop music?", "Where do you usually get your K-pop news?", "What is your favorite group?", "Who are your favorite soloists?"]
        const splitOnSemiColon = ["What Race or Ethnicity do you identify as?", "Employment Status", "How do you listen to K-pop music?", "Where do you usually get your K-pop news?", "What is your favorite group?", "Who are your favorite soloists?"];
        const responseAnswers = splitOnSemiColon.includes(key) ? cleanedResults.map(answer => answer[key].split(";")).flat() : cleanedResults.map(answer => answer[key]);
        const responseOptions = [...new Set<string>(responseAnswers)];
        const responseGroups = groupBy(responseAnswers);
        const responseFrequencies = responseOptions.reduce((accumulator, option) => ({ ...accumulator, [option]: responseGroups[option].length }), {} as Record<string, number>);
        let colorfn: (index: number) => string = () => "#d6287f";
        if (key === "Sexuality") {
          colorfn = (index) => ["#FF0018", "#FFA52C", "#FFFF41", "#008018", "#0000F9", "#86007D"][index % 6];
        }
        let sortFn: (key1: string, key2: string) => number;
        if (sortOnKeys.includes(key)) {
          sortFn = (key1, key2) => key1 > key2 ? 1 : -1;
        } else {
          sortFn = (key1, key2) => responseFrequencies[key2] - responseFrequencies[key1];
        }
        return (
          <section className="section" key={key}>
            <div className="container">
              <article className="message is-primary">
                <div className="message-header"><p>{key}</p></div>
                <div className="message-body">
                  {barGraphs.includes(key) && new Array(myCachingFunction(`responseOptionLength,${key}`, () => Math.ceil(responseOptions.length / 39))).fill(null).map((_, index) => {
                    const data = myCachingFunction(`${index},${key},barGraph`, () => [...responseOptions].sort(sortFn).map((item, index) => ({ label: item, value: responseFrequencies[item], color: colorfn(index) })).slice(39 * index, 39 * (index + 1)));

                    return <BarGraph key={index}
                      data={data} />
                  })
                  }
                  {key === "Education" &&
                    <StackedBarGraph
                      data={myCachingFunction(`${key},stackedBarGraph`, () => responseOptions.map((option) => {
                        const normalizedOption = option.replace(
                          "Currently Enrolled in High School",
                          "High School Graduate, Diploma or the equivalent (i.e. GED) (in progress)",
                        );
                        const stack = normalizedOption.replace(/ \(in progress\)/i, "");
                        const stackOrder = normalizedOption.toLowerCase().endsWith(" (in progress)") ? 2 : 1;
                        return {
                          stack: stack, label: option, value: responseFrequencies[option],
                          color: stackOrder === 1 ? "#d6287f" : "#572A41", stackOrder: stackOrder
                        }
                      }))}
                    />
                  }
                  <ul>{!splitOnSemiColon.includes(key) && readableCount(new Map(myCachingFunction(`${key},readableCount`, () => [...countThings(result => result[key]).entries()].sort((a, b) => a[0] < b[0] ? 1 : -1))))}</ul>
                </div></article></div>
          </section>)
      })}
    </div>
  );
}

function myCachingFunction<T>(name: string, value: () => T): T {
  // const item = window.localStorage.getItem(name)
  // if (item === null) {
  //   const result = value();
  //   window.localStorage.setItem(name, JSON.stringify(result));
  //   return result;
  // }
  // return JSON.parse(item);
  return JSON.parse((cacheContents as any)[name]);
}
export default App;
